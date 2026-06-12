import {
    Prisma,
    ProxyAccessAlerts,
    ProxyAccessAuditSettings,
    ProxyAccessLogs,
} from '@prisma/client';

import { Injectable, Logger } from '@nestjs/common';

import { fail, ok, TResult } from '@common/types';
import {
    CleanupProxyAccessAuditCommand,
    GetProxyAccessAlertsCommand,
    GetProxyAccessLogsCommand,
    GetProxyAccessRuleHitsCommand,
    GetProxyAccessSummaryCommand,
    GetProxyAccessTopDomainsCommand,
    IngestProxyAccessLogsCommand,
    UpdateProxyAccessAuditSettingsCommand,
} from '@libs/contracts/commands';
import { ERRORS } from '@libs/contracts/constants';
import {
    ProxyAccessAlertSeverity,
    ProxyAccessAlertStatus,
    ProxyAccessAlertType,
} from '@libs/contracts/models/proxy-access-audit.schema';

import { ProxyAccessAuditRepository } from './repositories/proxy-access-audit.repository';

const SENSITIVE_KEYS = /authorization|cookie|password|private.?key|secret|token/i;
const EGRESS_RULE_TAG_PREFIX = 'RULE_EGRESS_';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type IngestLogItem = IngestProxyAccessLogsCommand.Request['logs'][number];
type LogCreateInput = Prisma.ProxyAccessLogsCreateManyInput;
type AlertCreateInput = Prisma.ProxyAccessAlertsCreateManyInput;

@Injectable()
export class ProxyAccessAuditService {
    private readonly logger = new Logger(ProxyAccessAuditService.name);

    constructor(private readonly repository: ProxyAccessAuditRepository) {}

    public async ingestLogs(
        dto: IngestProxyAccessLogsCommand.Request,
    ): Promise<TResult<{ accepted: number; alertsCreated: number }>> {
        try {
            const settings = await this.repository.getSettings();

            if (!settings.isEnabled) {
                return ok({ accepted: 0, alertsCreated: 0 });
            }

            const logs = await this.normalizeLogs(dto.logs);
            const accepted = await this.repository.createLogs(logs);

            await this.updateRuleTrafficStats(logs);
            const alerts = await this.evaluateAlerts(logs, settings);
            const alertsCreated = await this.repository.createAlerts(alerts);

            return ok({ accepted, alertsCreated });
        } catch (error) {
            this.logger.error('Failed to ingest proxy access audit logs', error);
            return fail(ERRORS.INGEST_PROXY_ACCESS_AUDIT_ERROR);
        }
    }

    public async getLogs(query: GetProxyAccessLogsCommand.RequestQuery): Promise<
        TResult<{
            aggregateOnly: boolean;
            records: ReturnType<ProxyAccessAuditService['mapLog']>[];
            total: number;
        }>
    > {
        try {
            const settings = await this.repository.getSettings();

            if (settings.aggregateOnly) {
                return ok({ aggregateOnly: true, records: [], total: 0 });
            }

            const [records, total] = await this.repository.findLogs(query);
            return ok({
                aggregateOnly: false,
                records: records.map((record) => this.mapLog(record, settings)),
                total,
            });
        } catch (error) {
            this.logger.error('Failed to get proxy access logs', error);
            return fail(ERRORS.GET_PROXY_ACCESS_AUDIT_ERROR);
        }
    }

    public async getSummary(
        query: GetProxyAccessSummaryCommand.RequestQuery,
    ): Promise<TResult<ReturnType<ProxyAccessAuditService['mapSummary']>>> {
        try {
            return ok(this.mapSummary(await this.repository.getSummary(query)));
        } catch (error) {
            this.logger.error('Failed to get proxy access summary', error);
            return fail(ERRORS.GET_PROXY_ACCESS_AUDIT_ERROR);
        }
    }

    public async getTopDomains(
        query: GetProxyAccessTopDomainsCommand.RequestQuery,
    ): Promise<TResult<ReturnType<ProxyAccessAuditService['mapTopDomain']>[]>> {
        try {
            const rows = await this.repository.getTopDomains(query);
            return ok(rows.map((row) => this.mapTopDomain(row)));
        } catch (error) {
            this.logger.error('Failed to get proxy access top domains', error);
            return fail(ERRORS.GET_PROXY_ACCESS_AUDIT_ERROR);
        }
    }

    public async getRuleHits(
        query: GetProxyAccessRuleHitsCommand.RequestQuery,
    ): Promise<TResult<ReturnType<ProxyAccessAuditService['mapRuleHit']>[]>> {
        try {
            const rows = await this.repository.getRuleHits(query);
            return ok(rows.map((row) => this.mapRuleHit(row)));
        } catch (error) {
            this.logger.error('Failed to get proxy access rule hits', error);
            return fail(ERRORS.GET_PROXY_ACCESS_AUDIT_ERROR);
        }
    }

    public async getAlerts(query: GetProxyAccessAlertsCommand.RequestQuery): Promise<
        TResult<{
            records: ReturnType<ProxyAccessAuditService['mapAlert']>[];
            total: number;
        }>
    > {
        try {
            const settings = await this.repository.getSettings();
            const [records, total] = await this.repository.findAlerts(query);
            return ok({
                records: records.map((record) => this.mapAlert(record, settings)),
                total,
            });
        } catch (error) {
            this.logger.error('Failed to get proxy access alerts', error);
            return fail(ERRORS.GET_PROXY_ACCESS_AUDIT_ERROR);
        }
    }

    public async getSettings(): Promise<
        TResult<ReturnType<ProxyAccessAuditService['mapSettings']>>
    > {
        try {
            return ok(this.mapSettings(await this.repository.getSettings()));
        } catch (error) {
            this.logger.error('Failed to get proxy access audit settings', error);
            return fail(ERRORS.GET_PROXY_ACCESS_AUDIT_ERROR);
        }
    }

    public async updateSettings(
        dto: UpdateProxyAccessAuditSettingsCommand.Request,
    ): Promise<TResult<ReturnType<ProxyAccessAuditService['mapSettings']>>> {
        try {
            return ok(this.mapSettings(await this.repository.updateSettings(dto)));
        } catch (error) {
            this.logger.error('Failed to update proxy access audit settings', error);
            return fail(ERRORS.UPDATE_PROXY_ACCESS_AUDIT_SETTINGS_ERROR);
        }
    }

    public async cleanup(
        dto: CleanupProxyAccessAuditCommand.Request,
    ): Promise<TResult<{ deletedAlerts: number; deletedLogs: number }>> {
        try {
            const settings = await this.repository.getSettings();
            const retentionDays = dto.retentionDays ?? settings.retentionDays;

            const [deletedLogs, deletedAlerts] = await Promise.all([
                this.repository.cleanupLogs({
                    deleteAll: dto.deleteAll,
                    retentionDays,
                }),
                dto.clearAlerts
                    ? this.repository.cleanupAlerts(dto.deleteAll, retentionDays)
                    : Promise.resolve(0),
            ]);

            return ok({ deletedAlerts, deletedLogs });
        } catch (error) {
            this.logger.error('Failed to cleanup proxy access audit logs', error);
            return fail(ERRORS.CLEANUP_PROXY_ACCESS_AUDIT_ERROR);
        }
    }

    private async normalizeLogs(items: IngestLogItem[]): Promise<LogCreateInput[]> {
        const userIds = this.uniqueBigInts(items.map((item) => item.userId));
        const userUuids = this.uniqueStrings(items.map((item) => item.userUuid));
        const nodeUuids = this.uniqueStrings(items.map((item) => item.nodeUuid));
        const ruleUuids = this.uniqueStrings(
            items.map((item) => item.ruleUuid ?? this.ruleUuidFromOutboundTag(item.outboundTag)),
        );

        const [users, nodes, rules] = await Promise.all([
            this.repository.findUsersForSnapshots({ userIds, userUuids }),
            this.repository.findNodesForSnapshots(nodeUuids),
            this.repository.findRulesForSnapshots(ruleUuids),
        ]);

        const usersById = new Map(users.map((user) => [user.tId.toString(), user]));
        const usersByUuid = new Map(users.map((user) => [user.uuid, user]));
        const nodesByUuid = new Map(nodes.map((node) => [node.uuid, node]));
        const rulesByUuid = new Map(rules.map((rule) => [rule.uuid, rule]));

        return items.map((item) => {
            const user = item.userId
                ? usersById.get(item.userId)
                : item.userUuid
                  ? usersByUuid.get(item.userUuid)
                  : undefined;
            const node = item.nodeUuid ? nodesByUuid.get(item.nodeUuid) : undefined;
            const ruleUuid = item.ruleUuid ?? this.ruleUuidFromOutboundTag(item.outboundTag);
            const rule = ruleUuid ? rulesByUuid.get(ruleUuid) : undefined;
            const uplinkBytes = BigInt(item.uplinkBytes ?? '0');
            const downlinkBytes = BigInt(item.downlinkBytes ?? '0');
            const totalBytes = item.totalBytes
                ? BigInt(item.totalBytes)
                : uplinkBytes + downlinkBytes;
            const metadata = this.sanitizeMetadata(item.metadata);

            return {
                downlinkBytes,
                inboundTag: this.cleanOptionalString(item.inboundTag),
                metadata: metadata === undefined ? undefined : (metadata as Prisma.InputJsonValue),
                network: this.cleanOptionalString(item.network)?.toLowerCase(),
                nodeName: this.cleanOptionalString(item.nodeName) ?? node?.name,
                nodeUuid: item.nodeUuid,
                occurredAt: item.occurredAt ? new Date(item.occurredAt) : new Date(),
                outboundTag: this.cleanOptionalString(item.outboundTag),
                protocol: this.cleanOptionalString(item.protocol)?.toLowerCase(),
                ruleAction: this.cleanOptionalString(item.ruleAction) ?? rule?.action,
                ruleName: this.cleanOptionalString(item.ruleName) ?? rule?.name,
                ruleUuid,
                sessionId: this.cleanOptionalString(item.sessionId),
                targetHost: item.targetHost.trim().toLowerCase(),
                targetIp: this.cleanOptionalString(item.targetIp),
                targetPort: item.targetPort,
                totalBytes,
                uplinkBytes,
                userId: user?.tId ?? (item.userId ? BigInt(item.userId) : undefined),
                username: this.cleanOptionalString(item.username) ?? user?.username,
                userUuid: item.userUuid ?? user?.uuid,
            };
        });
    }

    private async updateRuleTrafficStats(logs: LogCreateInput[]): Promise<void> {
        const stats = new Map<
            string,
            {
                downlinkBytes: bigint;
                hitCount: bigint;
                lastHitAt: Date;
                nodeUuid: string;
                ruleUuid: string;
                uplinkBytes: bigint;
            }
        >();

        for (const log of logs) {
            if (!log.ruleUuid || !log.nodeUuid) continue;

            const key = `${log.ruleUuid}:${log.nodeUuid}`;
            const occurredAt = this.toDate(log.occurredAt);
            const current = stats.get(key) ?? {
                downlinkBytes: 0n,
                hitCount: 0n,
                lastHitAt: occurredAt,
                nodeUuid: log.nodeUuid,
                ruleUuid: log.ruleUuid,
                uplinkBytes: 0n,
            };

            current.downlinkBytes += BigInt(log.downlinkBytes ?? 0);
            current.hitCount += 1n;
            current.uplinkBytes += BigInt(log.uplinkBytes ?? 0);
            if (occurredAt > current.lastHitAt) {
                current.lastHitAt = occurredAt;
            }
            stats.set(key, current);
        }

        await Promise.all(
            Array.from(stats.values()).map(async (stat) => {
                try {
                    await this.repository.incrementRuleTrafficStats(stat);
                } catch (error) {
                    this.logger.warn(
                        `Failed to update egress rule traffic stats for rule ${stat.ruleUuid}`,
                        error,
                    );
                }
            }),
        );
    }

    private async evaluateAlerts(
        logs: LogCreateInput[],
        settings: ProxyAccessAuditSettings,
    ): Promise<AlertCreateInput[]> {
        const alerts: AlertCreateInput[] = [];
        const dedupe = new Set<string>();
        const highRiskPorts = new Set(settings.highRiskPorts);
        const blacklistedHosts = settings.blacklistedHosts.map((host) => host.toLowerCase());
        const blacklistedIps = new Set(settings.blacklistedIps);

        const pushAlert = (
            type: ProxyAccessAlertType,
            severity: ProxyAccessAlertSeverity,
            message: string,
            log: LogCreateInput,
            metadata?: Prisma.InputJsonValue,
        ) => {
            const key = [
                type,
                log.userId?.toString() ?? log.userUuid ?? log.username ?? '',
                log.nodeUuid ?? '',
                log.targetHost ?? '',
                log.targetIp ?? '',
                log.targetPort ?? '',
            ].join(':');

            if (dedupe.has(key)) return;
            dedupe.add(key);

            alerts.push({
                message,
                metadata,
                nodeName: log.nodeName,
                nodeUuid: log.nodeUuid,
                severity,
                targetHost: log.targetHost,
                targetIp: log.targetIp,
                targetPort: log.targetPort,
                type,
                userId: log.userId,
                username: log.username,
                userUuid: log.userUuid,
            });
        };

        for (const log of logs) {
            if (log.targetPort && highRiskPorts.has(log.targetPort)) {
                pushAlert(
                    'HIGH_RISK_PORT',
                    'warning',
                    `High-risk port ${log.targetPort} was accessed.`,
                    log,
                    { port: log.targetPort },
                );
            }

            if (log.targetHost && this.isHostBlacklisted(log.targetHost, blacklistedHosts)) {
                pushAlert(
                    'BLACKLIST_HIT',
                    'critical',
                    `Blacklisted host ${log.targetHost} was accessed.`,
                    log,
                    { targetHost: log.targetHost },
                );
            }

            if (log.targetIp && blacklistedIps.has(log.targetIp)) {
                pushAlert(
                    'BLACKLIST_HIT',
                    'critical',
                    `Blacklisted IP ${log.targetIp} was accessed.`,
                    log,
                    { targetIp: log.targetIp },
                );
            }
        }

        await this.evaluateDistinctDomainAlerts(logs, settings, alerts, dedupe);
        await this.evaluateNodeSpikeAlerts(logs, settings, alerts, dedupe);

        return alerts;
    }

    private async evaluateDistinctDomainAlerts(
        logs: LogCreateInput[],
        settings: ProxyAccessAuditSettings,
        alerts: AlertCreateInput[],
        dedupe: Set<string>,
    ): Promise<void> {
        const since = new Date(Date.now() - settings.distinctDomainWindowMinutes * 60 * 1000);
        const identities = new Map<string, LogCreateInput>();

        for (const log of logs) {
            const key = log.userId?.toString() ?? log.userUuid ?? log.username;
            if (key) identities.set(key, log);
        }

        await Promise.all(
            Array.from(identities.values()).map(async (log) => {
                const count = await this.repository.countDistinctDomainsForUser(
                    {
                        userId: this.toOptionalBigInt(log.userId),
                        username: log.username ?? undefined,
                        userUuid: log.userUuid ?? undefined,
                    },
                    since,
                );

                if (count < settings.distinctDomainThreshold) return;

                const key = `DISTINCT_DOMAINS:${log.userId?.toString() ?? log.userUuid ?? log.username}`;
                if (dedupe.has(key)) return;
                dedupe.add(key);

                alerts.push({
                    message: `User accessed ${count} distinct domains within ${settings.distinctDomainWindowMinutes} minutes.`,
                    metadata: {
                        count,
                        threshold: settings.distinctDomainThreshold,
                        windowMinutes: settings.distinctDomainWindowMinutes,
                    },
                    nodeName: log.nodeName,
                    nodeUuid: log.nodeUuid,
                    severity: 'warning',
                    type: 'DISTINCT_DOMAINS',
                    userId: log.userId,
                    username: log.username,
                    userUuid: log.userUuid,
                });
            }),
        );
    }

    private async evaluateNodeSpikeAlerts(
        logs: LogCreateInput[],
        settings: ProxyAccessAuditSettings,
        alerts: AlertCreateInput[],
        dedupe: Set<string>,
    ): Promise<void> {
        const nodeLogs = new Map<string, LogCreateInput>();
        for (const log of logs) {
            if (log.nodeUuid) nodeLogs.set(log.nodeUuid, log);
        }

        const now = new Date();
        const lastHourSince = new Date(now.getTime() - 60 * 60 * 1000);
        const previousSince = new Date(now.getTime() - 25 * 60 * 60 * 1000);

        await Promise.all(
            Array.from(nodeLogs.entries()).map(async ([nodeUuid, log]) => {
                const [recentBytes, previousBytes] = await Promise.all([
                    this.repository.getNodeTrafficSince(nodeUuid, lastHourSince),
                    this.repository.getNodeTrafficSince(nodeUuid, previousSince, lastHourSince),
                ]);

                const previousHourlyAverage = previousBytes / 24n;
                const multiplier = BigInt(settings.nodeSpikeMultiplier);
                const dynamicThreshold =
                    previousHourlyAverage > 0n
                        ? previousHourlyAverage * multiplier
                        : settings.nodeSpikeMinBytes * multiplier;

                if (recentBytes < settings.nodeSpikeMinBytes || recentBytes < dynamicThreshold) {
                    return;
                }

                const key = `NODE_TRAFFIC_SPIKE:${nodeUuid}`;
                if (dedupe.has(key)) return;
                dedupe.add(key);

                alerts.push({
                    message: `Node traffic spiked to ${recentBytes.toString()} bytes in the last hour.`,
                    metadata: {
                        dynamicThreshold: dynamicThreshold.toString(),
                        nodeSpikeMinBytes: settings.nodeSpikeMinBytes.toString(),
                        previousHourlyAverage: previousHourlyAverage.toString(),
                        recentBytes: recentBytes.toString(),
                    },
                    nodeName: log.nodeName,
                    nodeUuid,
                    severity: 'critical',
                    type: 'NODE_TRAFFIC_SPIKE',
                });
            }),
        );
    }

    private mapLog(record: ProxyAccessLogs, settings: ProxyAccessAuditSettings) {
        return {
            createdAt: record.createdAt,
            downlinkBytes: record.downlinkBytes.toString(),
            id: record.id,
            inboundTag: record.inboundTag,
            metadata: record.metadata,
            network: record.network,
            nodeName: record.nodeName,
            nodeUuid: record.nodeUuid,
            occurredAt: record.occurredAt,
            outboundTag: record.outboundTag,
            protocol: record.protocol,
            ruleAction: record.ruleAction,
            ruleName: record.ruleName,
            ruleUuid: record.ruleUuid,
            sessionId: record.sessionId,
            targetHost: record.targetHost,
            targetIp: record.targetIp,
            targetPort: record.targetPort,
            totalBytes: record.totalBytes.toString(),
            uplinkBytes: record.uplinkBytes.toString(),
            userId: record.userId?.toString() ?? null,
            username: this.maskUsername(record.username, settings),
            userUuid: record.userUuid,
        };
    }

    private mapSummary(summary: {
        alertCount: number;
        downlinkBytes: bigint;
        totalBytes: bigint;
        totalLogs: number;
        uniqueDomains: number;
        uniqueNodes: number;
        uniqueUsers: number;
        uplinkBytes: bigint;
    }) {
        return {
            alertCount: summary.alertCount,
            downlinkBytes: summary.downlinkBytes.toString(),
            totalBytes: summary.totalBytes.toString(),
            totalLogs: summary.totalLogs,
            uniqueDomains: summary.uniqueDomains,
            uniqueNodes: summary.uniqueNodes,
            uniqueUsers: summary.uniqueUsers,
            uplinkBytes: summary.uplinkBytes.toString(),
        };
    }

    private mapTopDomain(row: {
        downlinkBytes: bigint;
        hits: number;
        lastSeenAt: Date | null;
        targetHost: string;
        totalBytes: bigint;
        uniqueNodes: number;
        uniqueUsers: number;
        uplinkBytes: bigint;
    }) {
        return {
            downlinkBytes: row.downlinkBytes.toString(),
            hits: row.hits,
            lastSeenAt: row.lastSeenAt,
            targetHost: row.targetHost,
            totalBytes: row.totalBytes.toString(),
            uniqueNodes: row.uniqueNodes,
            uniqueUsers: row.uniqueUsers,
            uplinkBytes: row.uplinkBytes.toString(),
        };
    }

    private mapRuleHit(row: {
        cumulativeHitCount: bigint;
        downlinkBytes: bigint;
        hitCount: number;
        lastHitAt: Date | null;
        ruleAction: string | null;
        ruleName: string | null;
        ruleUuid: string | null;
        totalBytes: bigint;
        uniqueNodes: number;
        uniqueUsers: number;
        uplinkBytes: bigint;
    }) {
        return {
            cumulativeHitCount: row.cumulativeHitCount.toString(),
            downlinkBytes: row.downlinkBytes.toString(),
            hitCount: row.hitCount,
            lastHitAt: row.lastHitAt,
            ruleAction: row.ruleAction,
            ruleName: row.ruleName,
            ruleUuid: row.ruleUuid,
            totalBytes: row.totalBytes.toString(),
            uniqueNodes: row.uniqueNodes,
            uniqueUsers: row.uniqueUsers,
            uplinkBytes: row.uplinkBytes.toString(),
        };
    }

    private mapAlert(record: ProxyAccessAlerts, settings: ProxyAccessAuditSettings) {
        return {
            createdAt: record.createdAt,
            id: record.id,
            message: record.message,
            metadata: record.metadata,
            nodeName: record.nodeName,
            nodeUuid: record.nodeUuid,
            severity: record.severity as ProxyAccessAlertSeverity,
            status: record.status as ProxyAccessAlertStatus,
            targetHost: record.targetHost,
            targetIp: record.targetIp,
            targetPort: record.targetPort,
            type: record.type as ProxyAccessAlertType,
            userId: record.userId?.toString() ?? null,
            username: this.maskUsername(record.username, settings),
            userUuid: record.userUuid,
        };
    }

    private mapSettings(settings: ProxyAccessAuditSettings) {
        return {
            aggregateOnly: settings.aggregateOnly,
            blacklistedHosts: settings.blacklistedHosts,
            blacklistedIps: settings.blacklistedIps,
            createdAt: settings.createdAt,
            distinctDomainThreshold: settings.distinctDomainThreshold,
            distinctDomainWindowMinutes: settings.distinctDomainWindowMinutes,
            hideUsernames: settings.hideUsernames,
            highRiskPorts: settings.highRiskPorts,
            id: settings.id,
            isEnabled: settings.isEnabled,
            nodeSpikeMinBytes: settings.nodeSpikeMinBytes.toString(),
            nodeSpikeMultiplier: settings.nodeSpikeMultiplier,
            retentionDays: settings.retentionDays,
            updatedAt: settings.updatedAt,
        };
    }

    private cleanOptionalString(value: string | undefined): string | undefined {
        if (!value) return undefined;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }

    private toDate(value: Date | string): Date {
        return value instanceof Date ? value : new Date(value);
    }

    private toOptionalBigInt(value: bigint | number | null | undefined): bigint | undefined {
        if (value === null || value === undefined) return undefined;
        return typeof value === 'bigint' ? value : BigInt(value);
    }

    private isHostBlacklisted(host: string, patterns: string[]): boolean {
        return patterns.some((pattern) => {
            const normalized = pattern.replace(/^\*\./, '').toLowerCase();
            return host === normalized || host.endsWith(`.${normalized}`);
        });
    }

    private maskUsername(
        username: string | null,
        settings: ProxyAccessAuditSettings,
    ): string | null {
        if (!username) return null;
        return settings.hideUsernames ? '[hidden]' : username;
    }

    private sanitizeMetadata(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((item) => this.sanitizeMetadata(item));
        }

        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [
                    key,
                    SENSITIVE_KEYS.test(key) ? '[REDACTED]' : this.sanitizeMetadata(item),
                ]),
            );
        }

        return value;
    }

    private ruleUuidFromOutboundTag(tag: string | undefined): string | undefined {
        if (!tag) return undefined;
        if (UUID_REGEX.test(tag)) return tag.toLowerCase();
        if (!tag.startsWith(EGRESS_RULE_TAG_PREFIX)) return undefined;

        const uuidParts = tag.slice(EGRESS_RULE_TAG_PREFIX.length).split('_').slice(0, 5);
        if (uuidParts.length !== 5) return undefined;

        const uuid = uuidParts.join('-').toLowerCase();
        return UUID_REGEX.test(uuid) ? uuid : undefined;
    }

    private uniqueStrings(values: Array<string | undefined>): string[] {
        return Array.from(new Set(values.filter((value): value is string => !!value)));
    }

    private uniqueBigInts(values: Array<string | undefined>): bigint[] {
        return Array.from(
            new Set(
                values.filter((value): value is string => !!value).map((value) => BigInt(value)),
            ),
        );
    }
}
