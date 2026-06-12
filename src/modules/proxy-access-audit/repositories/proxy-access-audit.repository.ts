import {
    Prisma,
    ProxyAccessAlerts,
    ProxyAccessAuditSettings,
    ProxyAccessLogs,
} from '@prisma/client';

import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import {
    GetProxyAccessAlertsCommand,
    GetProxyAccessLogsCommand,
    GetProxyAccessRuleHitsCommand,
    GetProxyAccessSummaryCommand,
    GetProxyAccessTopDomainsCommand,
    UpdateProxyAccessAuditSettingsCommand,
} from '@libs/contracts/commands';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_REGEX = /^\d+$/;

type LogsQuery =
    | GetProxyAccessLogsCommand.RequestQuery
    | GetProxyAccessRuleHitsCommand.RequestQuery
    | GetProxyAccessSummaryCommand.RequestQuery
    | GetProxyAccessTopDomainsCommand.RequestQuery;

@Injectable()
export class ProxyAccessAuditRepository {
    constructor(private readonly prisma: TransactionHost<TransactionalAdapterPrisma>) {}

    public async createLogs(data: Prisma.ProxyAccessLogsCreateManyInput[]): Promise<number> {
        if (!data.length) return 0;

        const result = await this.prisma.tx.proxyAccessLogs.createMany({ data });
        return result.count;
    }

    public async findLogs(
        query: GetProxyAccessLogsCommand.RequestQuery,
    ): Promise<[ProxyAccessLogs[], number]> {
        const where = this.buildLogsWhere(query);

        const [records, total] = await Promise.all([
            this.prisma.tx.proxyAccessLogs.findMany({
                where,
                orderBy: { occurredAt: 'desc' },
                skip: query.start,
                take: query.size,
            }),
            this.prisma.tx.proxyAccessLogs.count({ where }),
        ]);

        return [records, total];
    }

    public async getSummary(query: GetProxyAccessSummaryCommand.RequestQuery): Promise<{
        alertCount: number;
        downlinkBytes: bigint;
        totalBytes: bigint;
        totalLogs: number;
        uniqueDomains: number;
        uniqueNodes: number;
        uniqueUsers: number;
        uplinkBytes: bigint;
    }> {
        const where = this.buildLogsWhere(query);
        const alertWhere = this.buildAlertsWhere({ ...query, status: 'OPEN' });

        const [aggregate, userRows, domainRows, nodeRows, alertCount] = await Promise.all([
            this.prisma.tx.proxyAccessLogs.aggregate({
                where,
                _count: { _all: true },
                _sum: {
                    downlinkBytes: true,
                    totalBytes: true,
                    uplinkBytes: true,
                },
            }),
            this.prisma.tx.proxyAccessLogs.findMany({
                where,
                select: { userId: true, userUuid: true, username: true },
                distinct: ['userId', 'userUuid', 'username'],
            }),
            this.prisma.tx.proxyAccessLogs.findMany({
                where,
                select: { targetHost: true },
                distinct: ['targetHost'],
            }),
            this.prisma.tx.proxyAccessLogs.findMany({
                where,
                select: { nodeUuid: true, nodeName: true },
                distinct: ['nodeUuid', 'nodeName'],
            }),
            this.prisma.tx.proxyAccessAlerts.count({ where: alertWhere }),
        ]);

        return {
            alertCount,
            downlinkBytes: aggregate._sum.downlinkBytes ?? 0n,
            totalBytes: aggregate._sum.totalBytes ?? 0n,
            totalLogs: aggregate._count._all,
            uniqueDomains: domainRows.length,
            uniqueNodes: new Set(
                nodeRows
                    .map((row) => row.nodeUuid ?? row.nodeName)
                    .filter((value): value is string => !!value),
            ).size,
            uniqueUsers: new Set(
                userRows
                    .map((row) => row.userUuid ?? row.userId?.toString() ?? row.username)
                    .filter((value): value is string => !!value),
            ).size,
            uplinkBytes: aggregate._sum.uplinkBytes ?? 0n,
        };
    }

    public async getTopDomains(query: GetProxyAccessTopDomainsCommand.RequestQuery): Promise<
        Array<{
            downlinkBytes: bigint;
            hits: number;
            lastSeenAt: Date | null;
            targetHost: string;
            totalBytes: bigint;
            uniqueNodes: number;
            uniqueUsers: number;
            uplinkBytes: bigint;
        }>
    > {
        const where = this.buildLogsWhere(query);

        const groups = await this.prisma.tx.proxyAccessLogs.groupBy({
            by: ['targetHost'],
            where,
            _count: { _all: true },
            _max: { occurredAt: true },
            _sum: {
                downlinkBytes: true,
                totalBytes: true,
                uplinkBytes: true,
            },
        });

        const top = groups
            .sort((left, right) =>
                Number((right._sum.totalBytes ?? 0n) - (left._sum.totalBytes ?? 0n)),
            )
            .slice(0, query.limit);

        const hosts = top.map((item) => item.targetHost);
        const identityRows = hosts.length
            ? await this.prisma.tx.proxyAccessLogs.findMany({
                  where: { ...where, targetHost: { in: hosts } },
                  select: {
                      nodeName: true,
                      nodeUuid: true,
                      targetHost: true,
                      userId: true,
                      userUuid: true,
                      username: true,
                  },
                  distinct: [
                      'targetHost',
                      'nodeUuid',
                      'nodeName',
                      'userId',
                      'userUuid',
                      'username',
                  ],
              })
            : [];

        const usersByHost = new Map<string, Set<string>>();
        const nodesByHost = new Map<string, Set<string>>();
        for (const row of identityRows) {
            const userKey = row.userUuid ?? row.userId?.toString() ?? row.username;
            const nodeKey = row.nodeUuid ?? row.nodeName;

            if (userKey) {
                const users = usersByHost.get(row.targetHost) ?? new Set<string>();
                users.add(userKey);
                usersByHost.set(row.targetHost, users);
            }
            if (nodeKey) {
                const nodes = nodesByHost.get(row.targetHost) ?? new Set<string>();
                nodes.add(nodeKey);
                nodesByHost.set(row.targetHost, nodes);
            }
        }

        return top.map((item) => ({
            downlinkBytes: item._sum.downlinkBytes ?? 0n,
            hits: item._count._all,
            lastSeenAt: item._max.occurredAt ?? null,
            targetHost: item.targetHost,
            totalBytes: item._sum.totalBytes ?? 0n,
            uniqueNodes: nodesByHost.get(item.targetHost)?.size ?? 0,
            uniqueUsers: usersByHost.get(item.targetHost)?.size ?? 0,
            uplinkBytes: item._sum.uplinkBytes ?? 0n,
        }));
    }

    public async getRuleHits(query: GetProxyAccessRuleHitsCommand.RequestQuery): Promise<
        Array<{
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
        }>
    > {
        const where: Prisma.ProxyAccessLogsWhereInput = {
            ...this.buildLogsWhere(query),
            OR: [{ ruleUuid: { not: null } }, { ruleName: { not: null } }],
        };

        const groups = await this.prisma.tx.proxyAccessLogs.groupBy({
            by: ['ruleUuid', 'ruleName', 'ruleAction'],
            where,
            _count: { _all: true },
            _max: { occurredAt: true },
            _sum: {
                downlinkBytes: true,
                totalBytes: true,
                uplinkBytes: true,
            },
        });

        const top = groups
            .sort((left, right) => right._count._all - left._count._all)
            .slice(0, query.limit);

        const ruleUuids = top.map((item) => item.ruleUuid).filter((uuid): uuid is string => !!uuid);
        const cumulativeRows = ruleUuids.length
            ? await this.prisma.tx.egressRuleTrafficStats.groupBy({
                  by: ['ruleUuid'],
                  where: { ruleUuid: { in: ruleUuids } },
                  _max: { lastHitAt: true },
                  _sum: {
                      downlinkBytes: true,
                      hitCount: true,
                      uplinkBytes: true,
                  },
              })
            : [];

        const cumulativeByRule = new Map(
            cumulativeRows.map((row) => [
                row.ruleUuid,
                {
                    hitCount: row._sum.hitCount ?? 0n,
                    lastHitAt: row._max.lastHitAt ?? null,
                },
            ]),
        );

        const identityRows = ruleUuids.length
            ? await this.prisma.tx.proxyAccessLogs.findMany({
                  where: { ...where, ruleUuid: { in: ruleUuids } },
                  select: {
                      nodeName: true,
                      nodeUuid: true,
                      ruleUuid: true,
                      userId: true,
                      userUuid: true,
                      username: true,
                  },
                  distinct: ['ruleUuid', 'nodeUuid', 'nodeName', 'userId', 'userUuid', 'username'],
              })
            : [];

        const usersByRule = new Map<string, Set<string>>();
        const nodesByRule = new Map<string, Set<string>>();
        for (const row of identityRows) {
            if (!row.ruleUuid) continue;

            const userKey = row.userUuid ?? row.userId?.toString() ?? row.username;
            const nodeKey = row.nodeUuid ?? row.nodeName;

            if (userKey) {
                const users = usersByRule.get(row.ruleUuid) ?? new Set<string>();
                users.add(userKey);
                usersByRule.set(row.ruleUuid, users);
            }
            if (nodeKey) {
                const nodes = nodesByRule.get(row.ruleUuid) ?? new Set<string>();
                nodes.add(nodeKey);
                nodesByRule.set(row.ruleUuid, nodes);
            }
        }

        return top.map((item) => {
            const cumulative = item.ruleUuid ? cumulativeByRule.get(item.ruleUuid) : undefined;
            const lastHitAt = cumulative?.lastHitAt ?? item._max.occurredAt ?? null;

            return {
                cumulativeHitCount: cumulative?.hitCount ?? BigInt(item._count._all),
                downlinkBytes: item._sum.downlinkBytes ?? 0n,
                hitCount: item._count._all,
                lastHitAt,
                ruleAction: item.ruleAction,
                ruleName: item.ruleName,
                ruleUuid: item.ruleUuid,
                totalBytes: item._sum.totalBytes ?? 0n,
                uniqueNodes: item.ruleUuid ? (nodesByRule.get(item.ruleUuid)?.size ?? 0) : 0,
                uniqueUsers: item.ruleUuid ? (usersByRule.get(item.ruleUuid)?.size ?? 0) : 0,
                uplinkBytes: item._sum.uplinkBytes ?? 0n,
            };
        });
    }

    public async findAlerts(
        query: GetProxyAccessAlertsCommand.RequestQuery,
    ): Promise<[ProxyAccessAlerts[], number]> {
        const where = this.buildAlertsWhere(query);

        const [records, total] = await Promise.all([
            this.prisma.tx.proxyAccessAlerts.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: query.start,
                take: query.size,
            }),
            this.prisma.tx.proxyAccessAlerts.count({ where }),
        ]);

        return [records, total];
    }

    public async createAlerts(data: Prisma.ProxyAccessAlertsCreateManyInput[]): Promise<number> {
        if (!data.length) return 0;

        const result = await this.prisma.tx.proxyAccessAlerts.createMany({ data });
        return result.count;
    }

    public async getSettings(): Promise<ProxyAccessAuditSettings> {
        return this.prisma.tx.proxyAccessAuditSettings.upsert({
            where: { id: 1 },
            create: { id: 1 },
            update: {},
        });
    }

    public async updateSettings(
        dto: UpdateProxyAccessAuditSettingsCommand.Request,
    ): Promise<ProxyAccessAuditSettings> {
        const data = {
            ...(dto.isEnabled === undefined ? {} : { isEnabled: dto.isEnabled }),
            ...(dto.aggregateOnly === undefined ? {} : { aggregateOnly: dto.aggregateOnly }),
            ...(dto.blacklistedHosts === undefined
                ? {}
                : { blacklistedHosts: dto.blacklistedHosts }),
            ...(dto.blacklistedIps === undefined ? {} : { blacklistedIps: dto.blacklistedIps }),
            ...(dto.distinctDomainThreshold === undefined
                ? {}
                : { distinctDomainThreshold: dto.distinctDomainThreshold }),
            ...(dto.distinctDomainWindowMinutes === undefined
                ? {}
                : { distinctDomainWindowMinutes: dto.distinctDomainWindowMinutes }),
            ...(dto.hideUsernames === undefined ? {} : { hideUsernames: dto.hideUsernames }),
            ...(dto.highRiskPorts === undefined ? {} : { highRiskPorts: dto.highRiskPorts }),
            ...(dto.nodeSpikeMinBytes === undefined
                ? {}
                : { nodeSpikeMinBytes: BigInt(dto.nodeSpikeMinBytes) }),
            ...(dto.nodeSpikeMultiplier === undefined
                ? {}
                : { nodeSpikeMultiplier: dto.nodeSpikeMultiplier }),
            ...(dto.retentionDays === undefined ? {} : { retentionDays: dto.retentionDays }),
        };

        return this.prisma.tx.proxyAccessAuditSettings.upsert({
            where: { id: 1 },
            create: { id: 1, ...data },
            update: data,
        });
    }

    public async cleanupLogs(options: {
        deleteAll?: boolean;
        retentionDays: number;
    }): Promise<number> {
        const where: Prisma.ProxyAccessLogsWhereInput = options.deleteAll
            ? {}
            : {
                  occurredAt: {
                      lt: new Date(Date.now() - options.retentionDays * 24 * 60 * 60 * 1000),
                  },
              };

        const result = await this.prisma.tx.proxyAccessLogs.deleteMany({ where });
        return result.count;
    }

    public async cleanupAlerts(deleteAll?: boolean, retentionDays = 30): Promise<number> {
        const where: Prisma.ProxyAccessAlertsWhereInput = deleteAll
            ? {}
            : {
                  createdAt: {
                      lt: new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000),
                  },
              };

        const result = await this.prisma.tx.proxyAccessAlerts.deleteMany({ where });
        return result.count;
    }

    public async findUsersForSnapshots(options: {
        userIds: bigint[];
        userUuids: string[];
    }): Promise<Array<{ tId: bigint; username: string; uuid: string }>> {
        const where: Prisma.UsersWhereInput[] = [];

        if (options.userIds.length) {
            where.push({ tId: { in: options.userIds } });
        }
        if (options.userUuids.length) {
            where.push({ uuid: { in: options.userUuids } });
        }
        if (!where.length) return [];

        return this.prisma.tx.users.findMany({
            where: { OR: where },
            select: { tId: true, username: true, uuid: true },
        });
    }

    public async findNodesForSnapshots(
        nodeUuids: string[],
    ): Promise<Array<{ name: string; uuid: string }>> {
        if (!nodeUuids.length) return [];

        return this.prisma.tx.nodes.findMany({
            where: { uuid: { in: nodeUuids } },
            select: { name: true, uuid: true },
        });
    }

    public async findRulesForSnapshots(
        ruleUuids: string[],
    ): Promise<Array<{ action: string; name: string; uuid: string }>> {
        if (!ruleUuids.length) return [];

        return this.prisma.tx.egressRules.findMany({
            where: { uuid: { in: ruleUuids } },
            select: { action: true, name: true, uuid: true },
        });
    }

    public async incrementRuleTrafficStats(options: {
        downlinkBytes: bigint;
        hitCount: bigint;
        lastHitAt: Date;
        nodeUuid: string;
        ruleUuid: string;
        uplinkBytes: bigint;
    }): Promise<void> {
        await this.prisma.tx.egressRuleTrafficStats.upsert({
            where: {
                ruleUuid_nodeUuid: {
                    nodeUuid: options.nodeUuid,
                    ruleUuid: options.ruleUuid,
                },
            },
            create: {
                downlinkBytes: options.downlinkBytes,
                hitCount: options.hitCount,
                lastHitAt: options.lastHitAt,
                nodeUuid: options.nodeUuid,
                ruleUuid: options.ruleUuid,
                uplinkBytes: options.uplinkBytes,
            },
            update: {
                downlinkBytes: { increment: options.downlinkBytes },
                hitCount: { increment: options.hitCount },
                lastHitAt: options.lastHitAt,
                uplinkBytes: { increment: options.uplinkBytes },
            },
        });
    }

    public async countDistinctDomainsForUser(
        identity: { userId?: bigint; userUuid?: string; username?: string },
        since: Date,
    ): Promise<number> {
        const userWhere = this.buildUserIdentityWhere(identity);
        if (!userWhere.length) return 0;

        const rows = await this.prisma.tx.proxyAccessLogs.findMany({
            where: {
                occurredAt: { gte: since },
                OR: userWhere,
            },
            select: { targetHost: true },
            distinct: ['targetHost'],
        });

        return rows.length;
    }

    public async getNodeTrafficSince(nodeUuid: string, since: Date, until?: Date): Promise<bigint> {
        const result = await this.prisma.tx.proxyAccessLogs.aggregate({
            where: {
                nodeUuid,
                occurredAt: {
                    gte: since,
                    ...(until ? { lt: until } : {}),
                },
            },
            _sum: { totalBytes: true },
        });

        return result._sum.totalBytes ?? 0n;
    }

    private buildLogsWhere(query: LogsQuery): Prisma.ProxyAccessLogsWhereInput {
        const and: Prisma.ProxyAccessLogsWhereInput[] = [];

        if (query.user) {
            and.push({ OR: this.buildUserQueryWhere(query.user) });
        }

        if (query.target) {
            and.push({
                OR: [
                    { targetHost: { contains: query.target, mode: 'insensitive' } },
                    { targetIp: { contains: query.target, mode: 'insensitive' } },
                ],
            });
        }

        return {
            ...(query.startTime || query.endTime
                ? {
                      occurredAt: {
                          ...(query.startTime ? { gte: new Date(query.startTime) } : {}),
                          ...(query.endTime ? { lte: new Date(query.endTime) } : {}),
                      },
                  }
                : {}),
            ...(query.nodeUuid ? { nodeUuid: query.nodeUuid } : {}),
            ...(query.outboundTag
                ? { outboundTag: { contains: query.outboundTag, mode: 'insensitive' } }
                : {}),
            ...(query.protocol
                ? { protocol: { contains: query.protocol, mode: 'insensitive' } }
                : {}),
            ...(query.ruleUuid ? { ruleUuid: query.ruleUuid } : {}),
            ...(query.targetPort ? { targetPort: query.targetPort } : {}),
            ...(and.length ? { AND: and } : {}),
        };
    }

    private buildAlertsWhere(
        query: GetProxyAccessAlertsCommand.RequestQuery | (LogsQuery & { status?: 'OPEN' }),
    ): Prisma.ProxyAccessAlertsWhereInput {
        const and: Prisma.ProxyAccessAlertsWhereInput[] = [];

        if ('user' in query && query.user) {
            and.push({ OR: this.buildAlertUserQueryWhere(query.user) });
        }

        if ('target' in query && query.target) {
            and.push({
                OR: [
                    { targetHost: { contains: query.target, mode: 'insensitive' } },
                    { targetIp: { contains: query.target, mode: 'insensitive' } },
                ],
            });
        }

        return {
            ...(query.startTime || query.endTime
                ? {
                      createdAt: {
                          ...(query.startTime ? { gte: new Date(query.startTime) } : {}),
                          ...(query.endTime ? { lte: new Date(query.endTime) } : {}),
                      },
                  }
                : {}),
            ...('nodeUuid' in query && query.nodeUuid ? { nodeUuid: query.nodeUuid } : {}),
            ...('severity' in query && query.severity ? { severity: query.severity } : {}),
            ...('status' in query && query.status ? { status: query.status } : {}),
            ...('type' in query && query.type ? { type: query.type } : {}),
            ...(and.length ? { AND: and } : {}),
        };
    }

    private buildUserIdentityWhere(identity: {
        userId?: bigint;
        userUuid?: string;
        username?: string;
    }): Prisma.ProxyAccessLogsWhereInput[] {
        return [
            ...(identity.userId ? [{ userId: identity.userId }] : []),
            ...(identity.userUuid ? [{ userUuid: identity.userUuid }] : []),
            ...(identity.username ? [{ username: identity.username }] : []),
        ];
    }

    private buildUserQueryWhere(value: string): Prisma.ProxyAccessLogsWhereInput[] {
        return [
            { username: { contains: value, mode: 'insensitive' } },
            ...(UUID_REGEX.test(value) ? [{ userUuid: value }] : []),
            ...(NUMERIC_REGEX.test(value) ? [{ userId: BigInt(value) }] : []),
        ];
    }

    private buildAlertUserQueryWhere(value: string): Prisma.ProxyAccessAlertsWhereInput[] {
        return [
            { username: { contains: value, mode: 'insensitive' } },
            ...(UUID_REGEX.test(value) ? [{ userUuid: value }] : []),
            ...(NUMERIC_REGEX.test(value) ? [{ userId: BigInt(value) }] : []),
        ];
    }
}
