import { lookup } from 'node:dns/promises';
import { Socket } from 'node:net';
import { isIP } from 'node:net';

import { Transactional } from '@nestjs-cls/transactional';
import { Injectable, Logger } from '@nestjs/common';

import {
    buildProxyOutbound,
    ProxyChainConfig,
} from '@common/helpers/proxy-chain/proxy-chain-injector';
import { fail, ok, TResult } from '@common/types';
import {
    EgressConfigBackup,
    ProxyGroupMode,
    ProxyOutboundConfig,
    ProxyOutboundConfigSchema,
    REDACTED_PROXY_SECRET,
} from '@libs/contracts/models';
import { ERRORS } from '@libs/contracts/constants';

import { AuditLogsService } from '@modules/audit-logs';
import { ResolvedProxyConfig } from '@modules/subscription-template/resolve-proxy/interfaces';

import { ProxySubscriptionsRepository } from './repositories/proxy-subscriptions.repository';
import { ProxyOutboundsRepository } from './repositories/proxy-outbounds.repository';
import {
    CreateEgressRuleRequestDto,
    ImportEgressRuleListRequestDto,
    UpdateEgressRuleRequestDto,
} from './dtos';
import { ProxyGroupsRepository } from './repositories/proxy-groups.repository';
import { EgressRulesRepository } from './repositories/egress-rules.repository';
import { ProxyOutboundEntity } from './entities/proxy-outbound.entity';
import { parseSubscriptionContent } from './proxy-subscription.parser';
import { ProxyGroupEntity } from './entities/proxy-group.entity';
import { EgressRuleEntity } from './entities/egress-rule.entity';
import { parseEgressRuleList } from './egress-rule-list.parser';

const EGRESS_DIRECT_TAG = 'EGRESS_DIRECT';
const EGRESS_RULE_TAG_PREFIX = 'RULE_EGRESS_';
const egressRuleTag = (uuid: string): string =>
    `${EGRESS_RULE_TAG_PREFIX}${uuid.replaceAll('-', '_').toUpperCase()}`;
const egressRuleMemberTag = (uuid: string, index: number): string =>
    `${egressRuleTag(uuid)}_MEMBER_${index}`;
const egressRuleBalancerTag = (uuid: string): string => `${egressRuleTag(uuid)}_BALANCER`;

function ruleUuidFromOutboundTag(tag: string): string | null {
    if (!tag.startsWith(EGRESS_RULE_TAG_PREFIX)) return null;
    const uuidParts = tag.slice(EGRESS_RULE_TAG_PREFIX.length).split('_').slice(0, 5);
    if (uuidParts.length !== 5) return null;
    const uuid = uuidParts.join('-').toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)
        ? uuid
        : null;
}

function isPrivateAddress(address: string): boolean {
    if (address === '::1' || address.startsWith('fc') || address.startsWith('fd')) return true;
    if (!isIP(address)) return false;
    const parts = address.split('.').map(Number);
    return (
        parts[0] === 10 ||
        parts[0] === 127 ||
        (parts[0] === 169 && parts[1] === 254) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168)
    );
}

function ipInCidr(ip: string, cidr: string): boolean {
    try {
        const [range, bitsStr] = cidr.split('/');
        const bits = parseInt(bitsStr, 10);
        const ipParts = ip.split('.').map(Number);
        const rangeParts = range.split('.').map(Number);
        if (ipParts.length !== 4 || rangeParts.length !== 4 || isNaN(bits)) return false;

        const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
        const rangeNum =
            (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];

        const mask = bits === 0 ? 0 : ~0 << (32 - bits);
        return (ipNum & mask) === (rangeNum & mask);
    } catch {
        return false;
    }
}

const PROXY_SECRET_FIELDS: (keyof ProxyOutboundConfig)[] = [
    'password',
    'username',
    'uuid',
    'realityPublicKey',
    'realityShortId',
];

function redactProxyConfig(config: ProxyOutboundConfig): ProxyOutboundConfig {
    const redacted = { ...config };
    for (const field of PROXY_SECRET_FIELDS) {
        if (redacted[field]) {
            Object.assign(redacted, { [field]: REDACTED_PROXY_SECRET });
        }
    }
    return redacted;
}

function mergeRedactedProxyConfig(
    imported: ProxyOutboundConfig,
    existing?: ProxyOutboundConfig,
): ProxyOutboundConfig {
    const merged = { ...imported };
    for (const field of PROXY_SECRET_FIELDS) {
        if (merged[field] === REDACTED_PROXY_SECRET) {
            Object.assign(merged, { [field]: existing?.[field] });
        }
    }
    return merged;
}

function redactProxyOutbound(outbound: ProxyOutboundEntity): ProxyOutboundEntity {
    return new ProxyOutboundEntity({
        ...outbound,
        config: redactProxyConfig(outbound.config),
    });
}

function connectSocket(address: string, port: number): Promise<Socket> {
    return new Promise((resolve, reject) => {
        const socket = new Socket();
        socket.setTimeout(5000);
        socket.once('connect', () => resolve(socket));
        socket.once('timeout', () => reject(new Error('Connection timed out after 5 seconds.')));
        socket.once('error', reject);
        socket.connect(port, address);
    });
}

function exchangeSocket(socket: Socket, payload: Buffer | string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            socket.off('data', onData);
            socket.off('error', onError);
            socket.off('timeout', onTimeout);
        };
        const onData = (data: Buffer) => {
            cleanup();
            resolve(data);
        };
        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };
        const onTimeout = () => {
            cleanup();
            reject(new Error('Proxy handshake timed out.'));
        };
        socket.once('data', onData);
        socket.once('error', onError);
        socket.once('timeout', onTimeout);
        socket.write(payload);
    });
}

async function testHttpProxy(config: ProxyOutboundConfig): Promise<string> {
    const socket = await connectSocket(config.address, config.port);
    try {
        const authorization =
            config.username || config.password
                ? `Proxy-Authorization: Basic ${Buffer.from(`${config.username ?? ''}:${config.password ?? ''}`).toString('base64')}\r\n`
                : '';
        const response = await exchangeSocket(
            socket,
            `CONNECT 1.1.1.1:443 HTTP/1.1\r\nHost: 1.1.1.1:443\r\n${authorization}\r\n`,
        );
        const statusLine = response.toString('utf8').split('\r\n')[0];
        if (!/^HTTP\/1\.[01] 2\d\d/.test(statusLine)) {
            throw new Error(`HTTP proxy rejected CONNECT: ${statusLine}`);
        }
        return 'HTTP CONNECT tunnel established through proxy.';
    } finally {
        socket.destroy();
    }
}

async function testSocks5Proxy(config: ProxyOutboundConfig): Promise<string> {
    const socket = await connectSocket(config.address, config.port);
    try {
        const useAuth = !!(config.username || config.password);
        const greeting = await exchangeSocket(
            socket,
            Buffer.from(useAuth ? [0x05, 0x02, 0x00, 0x02] : [0x05, 0x01, 0x00]),
        );
        if (greeting[0] !== 0x05 || greeting[1] === 0xff) {
            throw new Error('SOCKS5 proxy rejected authentication methods.');
        }
        if (greeting[1] === 0x02) {
            const username = Buffer.from(config.username ?? '');
            const password = Buffer.from(config.password ?? '');
            const auth = await exchangeSocket(
                socket,
                Buffer.concat([
                    Buffer.from([0x01, username.length]),
                    username,
                    Buffer.from([password.length]),
                    password,
                ]),
            );
            if (auth[1] !== 0x00)
                throw new Error('SOCKS5 username/password authentication failed.');
        }
        const connect = await exchangeSocket(
            socket,
            Buffer.from([0x05, 0x01, 0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0xbb]),
        );
        if (connect[0] !== 0x05 || connect[1] !== 0x00) {
            throw new Error(`SOCKS5 CONNECT failed with code ${connect[1] ?? 'unknown'}.`);
        }
        return 'SOCKS5 authentication and outbound CONNECT succeeded.';
    } finally {
        socket.destroy();
    }
}

export function matchPattern(target: string, pattern: string): boolean {
    const cleanTarget = target.trim().toLowerCase();
    const cleanPattern = pattern.trim().toLowerCase();

    if (cleanPattern.startsWith('domain:')) {
        const domain = cleanPattern.substring(7);
        return cleanTarget === domain || cleanTarget.endsWith('.' + domain);
    }
    if (cleanPattern.startsWith('keyword:')) {
        const keyword = cleanPattern.substring(8);
        return cleanTarget.includes(keyword);
    }
    if (cleanPattern.startsWith('full:')) {
        const full = cleanPattern.substring(5);
        return cleanTarget === full;
    }
    if (cleanPattern.startsWith('regexp:')) {
        const regexpStr = cleanPattern.substring(7);
        try {
            const rx = new RegExp(regexpStr);
            return rx.test(cleanTarget);
        } catch {
            return false;
        }
    }
    if (cleanPattern.startsWith('ip:')) {
        const ip = cleanPattern.substring(3);
        return cleanTarget === ip;
    }
    if (cleanPattern.includes('/') && /^[0-9./]+$/.test(cleanPattern)) {
        return ipInCidr(cleanTarget, cleanPattern);
    }
    if (/^[0-9.]+$/.test(cleanPattern)) {
        return cleanTarget === cleanPattern;
    }

    return cleanTarget === cleanPattern || cleanTarget.includes(cleanPattern);
}

@Injectable()
export class EgressRulesService {
    private readonly logger = new Logger(EgressRulesService.name);

    constructor(
        private readonly repository: EgressRulesRepository,
        private readonly proxyOutboundsRepository: ProxyOutboundsRepository,
        private readonly proxyGroupsRepository: ProxyGroupsRepository,
        private readonly proxySubscriptionsRepository: ProxySubscriptionsRepository,
        private readonly auditLogsService: AuditLogsService,
    ) {}

    private subscriptionResponse(subscription: {
        _count: { outbounds: number };
        [key: string]: unknown;
    }) {
        const { _count, ...data } = subscription;
        return { ...data, nodeCount: _count.outbounds };
    }

    public async findProxySubscriptions(): Promise<TResult<any[]>> {
        try {
            return ok(
                (await this.proxySubscriptionsRepository.findAll()).map((item) =>
                    this.subscriptionResponse(item),
                ),
            );
        } catch (error) {
            this.logger.error('Failed to fetch proxy subscriptions', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async syncDueProxySubscriptions(): Promise<void> {
        const subscriptions = await this.proxySubscriptionsRepository.findAll();
        const now = Date.now();
        for (const subscription of subscriptions) {
            if (!subscription.isEnabled) continue;
            const lastSync = subscription.lastSyncAt?.getTime() ?? 0;
            if (now - lastSync >= subscription.updateIntervalMin * 60_000) {
                await this.syncProxySubscription(subscription.uuid);
            }
        }
    }

    public async createProxySubscription(dto: {
        name: string;
        url: string;
        isEnabled?: boolean;
        updateIntervalMin?: number;
        distributionMode?: string;
        targetUserIds?: number[];
        targetSquadUuids?: string[];
    }): Promise<TResult<any>> {
        try {
            const created = await this.proxySubscriptionsRepository.create(dto);
            const synced = await this.syncProxySubscription(created.uuid);
            return synced.isOk ? synced : ok(this.subscriptionResponse(created));
        } catch (error) {
            this.logger.error('Failed to create proxy subscription', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async updateProxySubscription(
        uuid: string,
        dto: {
            name?: string;
            url?: string;
            isEnabled?: boolean;
            distributionMode?: string;
            targetUserIds?: number[];
            targetSquadUuids?: string[];
            updateIntervalMin?: number;
        },
    ): Promise<TResult<any>> {
        try {
            const updated = await this.proxySubscriptionsRepository.update(uuid, dto);
            return ok(this.subscriptionResponse(updated));
        } catch (error) {
            this.logger.error('Failed to update proxy subscription', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async getDistributedProxyConfigs(userId: bigint): Promise<ResolvedProxyConfig[]> {
        const subscriptions =
            await this.proxySubscriptionsRepository.findDistributedForUser(userId);
        return subscriptions.flatMap((subscription) =>
            subscription.outbounds
                .map((outbound) =>
                    this.proxyOutboundToResolvedConfig(
                        outbound.uuid,
                        outbound.name,
                        outbound.config as ProxyOutboundConfig,
                    ),
                )
                .filter((item): item is ResolvedProxyConfig => item !== null),
        );
    }

    private proxyOutboundToResolvedConfig(
        uuid: string,
        name: string,
        config: ProxyOutboundConfig,
    ): ResolvedProxyConfig | null {
        if (!['vless', 'trojan', 'shadowsocks'].includes(config.protocol)) return null;
        if (config.network === 'h2') return null;

        const metadata = {
            uuid,
            tag: null,
            excludeFromSubscriptionTypes: [],
            inboundTag: `REMOTE_${uuid}`,
            configProfileUuid: null,
            configProfileInboundUuid: null,
            isDisabled: false,
            isHidden: false,
            viewPosition: 0,
            remark: name,
            vlessRouteId: null,
            rawInbound: null,
        };
        const common = {
            finalRemark: name,
            address: config.address,
            port: config.port,
            streamOverrides: { finalMask: null, sockopt: null },
            mux: null,
            clientOverrides: {
                shuffleHost: false,
                mihomoX25519: false,
                serverDescription: null,
                xrayJsonTemplate: null,
            },
            metadata,
        };
        const transport = this.resolveDistributedTransport(config);
        const security = this.resolveDistributedSecurity(config);

        if (config.protocol === 'vless' && config.uuid) {
            return {
                ...common,
                ...transport,
                ...security,
                protocol: 'vless',
                protocolOptions: {
                    encryption: config.security || 'none',
                    id: config.uuid,
                    flow: (config.flow || '') as never,
                },
            };
        }
        if (config.protocol === 'trojan' && config.password) {
            return {
                ...common,
                ...transport,
                ...security,
                protocol: 'trojan',
                protocolOptions: { password: config.password },
            };
        }
        if (config.protocol === 'shadowsocks' && config.password && config.method) {
            return {
                ...common,
                ...transport,
                ...security,
                protocol: 'shadowsocks',
                protocolOptions: {
                    method: config.method,
                    password: config.password,
                    uot: false,
                    uotVersion: 2,
                },
            };
        }
        return null;
    }

    private resolveDistributedTransport(config: ProxyOutboundConfig): any {
        switch (config.network) {
            case 'ws':
                return {
                    transport: 'ws',
                    transportOptions: {
                        path: config.wsPath || null,
                        host: config.wsHost || null,
                        headers: null,
                        heartbeatPeriod: null,
                    },
                };
            case 'grpc':
                return {
                    transport: 'grpc',
                    transportOptions: {
                        authority: null,
                        serviceName: config.grpcServiceName || null,
                        multiMode: false,
                    },
                };
            case 'xhttp':
                return {
                    transport: 'xhttp',
                    transportOptions: {
                        path: config.wsPath || null,
                        host: config.wsHost || null,
                        mode: 'auto',
                        extra: null,
                    },
                };
            default:
                return { transport: 'tcp', transportOptions: { header: null } };
        }
    }

    private resolveDistributedSecurity(config: ProxyOutboundConfig): any {
        if (config.tlsSecurity === 'reality' && config.realityPublicKey) {
            return {
                security: 'reality',
                securityOptions: {
                    fingerprint: config.fingerprint || 'chrome',
                    publicKey: config.realityPublicKey,
                    shortId: config.realityShortId || null,
                    serverName: config.sni || '',
                    spiderX: config.realitySpiderX || null,
                    mldsa65Verify: null,
                },
            };
        }
        if (config.tlsSecurity === 'tls') {
            return {
                security: 'tls',
                securityOptions: {
                    allowInsecure: config.allowInsecure || false,
                    alpn: null,
                    enableSessionResumption: false,
                    fingerprint: config.fingerprint || null,
                    serverName: config.sni || null,
                    echConfigList: null,
                    echForceQuery: null,
                },
            };
        }
        return { security: 'none' };
    }

    public async syncProxySubscription(uuid: string): Promise<TResult<any>> {
        const subscription = await this.proxySubscriptionsRepository.findByUUID(uuid);
        if (!subscription) return fail(ERRORS.INTERNAL_SERVER_ERROR);
        try {
            const url = new URL(subscription.url);
            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('Only HTTP and HTTPS subscription URLs are allowed.');
            }
            const addresses = await lookup(url.hostname, { all: true });
            if (
                addresses.length === 0 ||
                addresses.some((item) => isPrivateAddress(item.address))
            ) {
                throw new Error('Private or local subscription hosts are not allowed.');
            }
            const response = await fetch(url, {
                headers: { Accept: 'text/plain, application/yaml, application/json' },
                signal: AbortSignal.timeout(15_000),
            });
            if (!response.ok) throw new Error(`Subscription returned HTTP ${response.status}.`);
            const length = Number(response.headers.get('content-length') || 0);
            if (length > 5_000_000) throw new Error('Subscription exceeds the 5 MB limit.');
            const content = await response.text();
            if (Buffer.byteLength(content) > 5_000_000) {
                throw new Error('Subscription exceeds the 5 MB limit.');
            }
            const nodes = parseSubscriptionContent(content);
            if (nodes.length === 0) throw new Error('No supported proxy nodes were found.');
            await this.proxySubscriptionsRepository.replaceNodes(uuid, nodes);
            const updated = await this.proxySubscriptionsRepository.updateSync(uuid, {
                lastSyncAt: new Date(),
                lastSyncStatus: 'SUCCESS',
                lastSyncMessage: `Synchronized ${nodes.length} nodes.`,
            });
            return ok(this.subscriptionResponse(updated));
        } catch (error) {
            const updated = await this.proxySubscriptionsRepository.updateSync(uuid, {
                lastSyncAt: new Date(),
                lastSyncStatus: 'FAILED',
                lastSyncMessage: error instanceof Error ? error.message : String(error),
            });
            return ok(this.subscriptionResponse(updated));
        }
    }

    public async deleteProxySubscription(uuid: string): Promise<TResult<{ isDeleted: boolean }>> {
        try {
            return ok({ isDeleted: await this.proxySubscriptionsRepository.deleteByUUID(uuid) });
        } catch (error) {
            this.logger.error('Failed to delete proxy subscription', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async create(
        dto: CreateEgressRuleRequestDto,
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<EgressRuleEntity>> {
        try {
            const entity = new EgressRuleEntity({
                name: dto.name,
                description: dto.description,
                pattern: dto.pattern,
                action: dto.action,
                isEnabled: dto.isEnabled ?? true,
                targetUsers: dto.targetUsers,
                proxyOutboundUuid: dto.action === 'PROXY' ? dto.proxyOutboundUuid : null,
                proxyGroupUuid: dto.action === 'PROXY' ? dto.proxyGroupUuid : null,
                validFrom: dto.validFrom ?? null,
                expiresAt: dto.expiresAt ?? null,
            });

            const result = await this.repository.create(entity);

            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'egress-rule.create',
                resourceType: 'egress-rule',
                resourceId: result.uuid,
                result: 'success',
                message: `Created egress rule "${dto.name}" with pattern "${dto.pattern}".`,
                metadata: { rule: result },
            });

            return ok(result);
        } catch (error) {
            this.logger.error('Failed to create egress rule', error);
            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'egress-rule.create',
                resourceType: 'egress-rule',
                result: 'failed',
                message: `Failed to create egress rule "${dto.name}": ${error instanceof Error ? error.message : String(error)}`,
            });
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async importRuleList(
        dto: ImportEgressRuleListRequestDto,
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<
        TResult<{
            created: number;
            duplicates: number;
            existingConflicts: number;
            internalDuplicates: number;
            parsed: number;
            preview: { duplicate: boolean; name: string; pattern: string }[];
            skipped: number;
            unsupported: number;
        }>
    > {
        try {
            let content = dto.source;
            if (dto.sourceType === 'URL') {
                const url = new URL(dto.source);
                const addresses = await lookup(url.hostname, { all: true });
                if (
                    addresses.length === 0 ||
                    addresses.some((item) => isPrivateAddress(item.address))
                ) {
                    throw new Error('Private or local rule-list hosts are not allowed.');
                }
                const response = await fetch(url, {
                    headers: { Accept: 'text/plain, application/yaml' },
                    signal: AbortSignal.timeout(15_000),
                });
                if (!response.ok) throw new Error(`Rule list returned HTTP ${response.status}.`);
                const length = Number(response.headers.get('content-length') || 0);
                if (length > 2_000_000) throw new Error('Rule list exceeds the 2 MB limit.');
                content = await response.text();
                if (Buffer.byteLength(content) > 2_000_000) {
                    throw new Error('Rule list exceeds the 2 MB limit.');
                }
            }

            const parsed = parseEgressRuleList(content);
            if (parsed.patterns.length === 0) {
                throw new Error('No supported rules were found in the supplied list.');
            }

            const existing = await this.repository.findByCriteria({});
            const existingPatterns = new Set(
                existing.map((rule) => rule.pattern.trim().toLowerCase()),
            );
            const preview = parsed.patterns.slice(0, 25).map((pattern) => {
                const suffix = pattern.replace(
                    /^(domain|full|keyword|geoip|geosite|port|protocol):/i,
                    '',
                );
                return {
                    duplicate: existingPatterns.has(pattern.toLowerCase()),
                    name: `${dto.namePrefix} - ${suffix}`.slice(0, 128),
                    pattern,
                };
            });
            const existingConflicts = parsed.patterns.filter((pattern) =>
                existingPatterns.has(pattern.toLowerCase()),
            ).length;

            if (dto.dryRun) {
                return ok({
                    created: 0,
                    duplicates: parsed.duplicates + existingConflicts,
                    existingConflicts,
                    internalDuplicates: parsed.duplicates,
                    parsed: parsed.patterns.length,
                    preview,
                    skipped: existingConflicts,
                    unsupported: parsed.unsupported,
                });
            }

            let created = 0;
            let duplicates = parsed.duplicates;

            for (const [index, pattern] of parsed.patterns.entries()) {
                if (existingPatterns.has(pattern.toLowerCase())) {
                    duplicates++;
                    continue;
                }
                const suffix = pattern.replace(/^(domain|full|keyword|geoip|geosite|port|protocol):/i, '');
                const name = `${dto.namePrefix} - ${suffix}`.slice(0, 128);
                await this.repository.create(
                    new EgressRuleEntity({
                        name,
                        description:
                            dto.sourceType === 'URL'
                                ? `Imported from ${dto.source}`
                                : `Imported from pasted rule list (${index + 1})`,
                        pattern,
                        action: dto.action,
                        isEnabled: dto.isEnabled ?? true,
                        targetUsers: dto.targetUsers ?? [],
                        proxyOutboundUuid:
                            dto.action === 'PROXY' ? dto.proxyOutboundUuid ?? null : null,
                        proxyGroupUuid:
                            dto.action === 'PROXY' ? dto.proxyGroupUuid ?? null : null,
                    }),
                );
                existingPatterns.add(pattern.toLowerCase());
                created++;
            }

            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'egress-rule.import-list',
                resourceType: 'egress-rule',
                result: 'success',
                message: `Imported ${created} rules with prefix "${dto.namePrefix}".`,
                metadata: {
                    created,
                    duplicates,
                    parsed: parsed.patterns.length,
                    sourceType: dto.sourceType,
                    unsupported: parsed.unsupported,
                },
            });

            return ok({
                created,
                duplicates,
                existingConflicts,
                internalDuplicates: parsed.duplicates,
                parsed: parsed.patterns.length,
                preview,
                skipped: duplicates,
                unsupported: parsed.unsupported,
            });
        } catch (error) {
            this.logger.error('Failed to import egress rule list', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async findAll(): Promise<TResult<EgressRuleEntity[]>> {
        try {
            const rules = await this.repository.findByCriteria({});
            const trafficTotals = await this.repository.getTrafficTotals();
            for (const rule of rules) {
                const totals = trafficTotals.get(rule.uuid);
                const uplinkBytes = totals?.uplinkBytes ?? 0n;
                const downlinkBytes = totals?.downlinkBytes ?? 0n;
                rule.trafficUplinkBytes = uplinkBytes.toString();
                rule.trafficDownlinkBytes = downlinkBytes.toString();
                rule.trafficTotalBytes = (uplinkBytes + downlinkBytes).toString();
                rule.trafficHitCount = (totals?.hitCount ?? 0n).toString();
                rule.lastTrafficHitAt = totals?.lastHitAt ?? null;
            }
            return ok(rules);
        } catch (error) {
            this.logger.error('Failed to fetch egress rules', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async recordRuleTraffic(
        nodeUuid: string,
        outbounds: Array<{ outbound: string; uplink: number; downlink: number }>,
    ): Promise<void> {
        const totals = new Map<string, { uplink: bigint; downlink: bigint }>();
        for (const outbound of outbounds) {
            const ruleUuid = ruleUuidFromOutboundTag(outbound.outbound);
            if (!ruleUuid) continue;
            const current = totals.get(ruleUuid) ?? { uplink: 0n, downlink: 0n };
            current.uplink += BigInt(outbound.uplink || 0);
            current.downlink += BigInt(outbound.downlink || 0);
            totals.set(ruleUuid, current);
        }

        await Promise.all(
            Array.from(totals.entries()).map(([ruleUuid, traffic]) =>
                this.repository.incrementTraffic(
                    ruleUuid,
                    nodeUuid,
                    traffic.uplink,
                    traffic.downlink,
                ),
            ),
        );
    }

    public async createProxyOutbound(
        dto: {
            name: string;
            description?: string | null;
            config: ProxyOutboundConfig;
            isEnabled?: boolean;
        },
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<ProxyOutboundEntity>> {
        try {
            const result = await this.proxyOutboundsRepository.create(dto);
            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'proxy-outbound.create',
                resourceType: 'proxy-outbound',
                resourceId: result.uuid,
                result: 'success',
                message: `Created proxy outbound "${result.name}".`,
            });
            return ok(redactProxyOutbound(result));
        } catch (error) {
            this.logger.error('Failed to create proxy outbound', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async findProxyOutbounds(): Promise<TResult<ProxyOutboundEntity[]>> {
        try {
            return ok(
                (await this.proxyOutboundsRepository.findAll()).map((outbound) =>
                    redactProxyOutbound(outbound),
                ),
            );
        } catch (error) {
            this.logger.error('Failed to fetch proxy outbounds', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async findProxyGroups(): Promise<TResult<ProxyGroupEntity[]>> {
        try {
            return ok(await this.proxyGroupsRepository.findAll());
        } catch (error) {
            this.logger.error('Failed to fetch proxy groups', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async exportConfig(includeSecrets: boolean): Promise<TResult<EgressConfigBackup>> {
        try {
            const [proxyOutbounds, proxyGroups, rules] = await Promise.all([
                this.proxyOutboundsRepository.findAll(),
                this.proxyGroupsRepository.findAll(),
                this.repository.findByCriteria({}),
            ]);
            return ok({
                format: 'remnawave-egress-config',
                version: 1,
                exportedAt: new Date(),
                includesSecrets: includeSecrets,
                proxyOutbounds: proxyOutbounds.map((outbound) => ({
                    uuid: outbound.uuid,
                    name: outbound.name,
                    description: outbound.description,
                    config: includeSecrets ? outbound.config : redactProxyConfig(outbound.config),
                    isEnabled: outbound.isEnabled,
                })),
                proxyGroups: proxyGroups.map((group) => ({
                    uuid: group.uuid,
                    name: group.name,
                    description: group.description,
                    mode: group.mode,
                    outboundUuids: group.outboundUuids,
                    isEnabled: group.isEnabled,
                })),
                rules: rules.map((rule) => ({
                    uuid: rule.uuid,
                    viewPosition: rule.viewPosition,
                    name: rule.name,
                    description: rule.description,
                    pattern: rule.pattern,
                    action: rule.action,
                    isEnabled: rule.isEnabled,
                    targetUsers: rule.targetUsers,
                    proxyOutboundUuid: rule.proxyOutboundUuid,
                    proxyGroupUuid: rule.proxyGroupUuid,
                    validFrom: rule.validFrom,
                    expiresAt: rule.expiresAt,
                })),
            });
        } catch (error) {
            this.logger.error('Failed to export egress configuration', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    @Transactional()
    public async importConfig(
        backup: EgressConfigBackup,
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<{ proxyOutbounds: number; proxyGroups: number; rules: number }>> {
        try {
            const outboundUuidMap = new Map<string, string>();
            for (const outbound of backup.proxyOutbounds) {
                const existing =
                    (await this.proxyOutboundsRepository.findByUUID(outbound.uuid)) ??
                    (await this.proxyOutboundsRepository.findByName(outbound.name));
                const targetUuid = existing?.uuid ?? outbound.uuid;
                const config = ProxyOutboundConfigSchema.parse(
                    mergeRedactedProxyConfig(outbound.config, existing?.config),
                );
                await this.proxyOutboundsRepository.upsert({
                    ...outbound,
                    uuid: targetUuid,
                    config,
                });
                outboundUuidMap.set(outbound.uuid, targetUuid);
            }

            const groupUuidMap = new Map<string, string>();
            for (const group of backup.proxyGroups) {
                const existing =
                    (await this.proxyGroupsRepository.findByUUID(group.uuid)) ??
                    (await this.proxyGroupsRepository.findByName(group.name));
                const targetUuid = existing?.uuid ?? group.uuid;
                await this.proxyGroupsRepository.upsert({
                    ...group,
                    uuid: targetUuid,
                    outboundUuids: group.outboundUuids.map(
                        (uuid) => outboundUuidMap.get(uuid) ?? uuid,
                    ),
                });
                groupUuidMap.set(group.uuid, targetUuid);
            }

            for (const rule of backup.rules) {
                await this.repository.upsert(
                    new EgressRuleEntity({
                        ...rule,
                        proxyOutboundUuid: rule.proxyOutboundUuid
                            ? (outboundUuidMap.get(rule.proxyOutboundUuid) ??
                              rule.proxyOutboundUuid)
                            : null,
                        proxyGroupUuid: rule.proxyGroupUuid
                            ? (groupUuidMap.get(rule.proxyGroupUuid) ?? rule.proxyGroupUuid)
                            : null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    }),
                );
            }

            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'egress-config.import',
                resourceType: 'egress-config',
                result: 'success',
                message: `Imported ${backup.rules.length} rules, ${backup.proxyOutbounds.length} outbounds and ${backup.proxyGroups.length} groups.`,
                metadata: {
                    version: backup.version,
                    includesSecrets: backup.includesSecrets,
                },
            });

            return ok({
                proxyOutbounds: backup.proxyOutbounds.length,
                proxyGroups: backup.proxyGroups.length,
                rules: backup.rules.length,
            });
        } catch (error) {
            this.logger.error('Failed to import egress configuration', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async createProxyGroup(
        dto: {
            name: string;
            description?: string | null;
            mode: ProxyGroupMode;
            outboundUuids: string[];
            isEnabled?: boolean;
        },
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<ProxyGroupEntity>> {
        try {
            const enabledOutbounds = await this.proxyOutboundsRepository.findEnabled();
            const enabledUuids = new Set(enabledOutbounds.map((outbound) => outbound.uuid));
            if (dto.outboundUuids.some((uuid) => !enabledUuids.has(uuid))) {
                return fail(ERRORS.INTERNAL_SERVER_ERROR);
            }
            const result = await this.proxyGroupsRepository.create(dto);
            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'proxy-group.create',
                resourceType: 'proxy-group',
                resourceId: result.uuid,
                result: 'success',
                message: `Created proxy group "${result.name}".`,
            });
            return ok(result);
        } catch (error) {
            this.logger.error('Failed to create proxy group', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async updateProxyGroup(
        dto: {
            uuid: string;
            name?: string;
            description?: string | null;
            mode?: ProxyGroupMode;
            outboundUuids?: string[];
            isEnabled?: boolean;
        },
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<ProxyGroupEntity>> {
        try {
            if (dto.outboundUuids) {
                const enabledOutbounds = await this.proxyOutboundsRepository.findEnabled();
                const enabledUuids = new Set(enabledOutbounds.map((outbound) => outbound.uuid));
                if (dto.outboundUuids.some((uuid) => !enabledUuids.has(uuid))) {
                    return fail(ERRORS.INTERNAL_SERVER_ERROR);
                }
            }
            const { uuid, ...data } = dto;
            const result = await this.proxyGroupsRepository.update(uuid, data);
            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'proxy-group.update',
                resourceType: 'proxy-group',
                resourceId: result.uuid,
                result: 'success',
                message: `Updated proxy group "${result.name}".`,
            });
            return ok(result);
        } catch (error) {
            this.logger.error('Failed to update proxy group', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async deleteProxyGroup(
        uuid: string,
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<boolean>> {
        try {
            const existing = await this.proxyGroupsRepository.findByUUID(uuid);
            if (!existing) return fail(ERRORS.INTERNAL_SERVER_ERROR);
            const result = await this.proxyGroupsRepository.deleteByUUID(uuid);
            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'proxy-group.delete',
                resourceType: 'proxy-group',
                resourceId: uuid,
                result: 'success',
                message: `Deleted proxy group "${existing.name}".`,
            });
            return ok(result);
        } catch (error) {
            this.logger.error('Failed to delete proxy group', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async testProxyOutbound(
        uuid: string,
    ): Promise<
        TResult<{ success: boolean; latencyMs: number | null; testedAt: Date; message: string }>
    > {
        const outbound = await this.proxyOutboundsRepository.findByUUID(uuid);
        if (!outbound) {
            return fail(ERRORS.PROXY_OUTBOUND_NOT_FOUND);
        }

        const testedAt = new Date();
        const startedAt = Date.now();
        let success = false;
        let message: string;
        try {
            if (outbound.config.protocol === 'http') {
                message = await testHttpProxy(outbound.config);
            } else if (outbound.config.protocol === 'socks5') {
                message = await testSocks5Proxy(outbound.config);
            } else {
                const socket = await connectSocket(outbound.config.address, outbound.config.port);
                socket.destroy();
                message = `${outbound.config.protocol.toUpperCase()} endpoint is TCP reachable; protocol authentication was not tested.`;
            }
            success = true;
        } catch (error) {
            message = error instanceof Error ? error.message : String(error);
        }
        const latencyMs = success ? Date.now() - startedAt : null;
        await this.proxyOutboundsRepository.updateHealth(uuid, {
            healthStatus: success ? 'HEALTHY' : 'UNHEALTHY',
            lastLatencyMs: latencyMs,
            lastHealthMessage: message,
            lastHealthCheckAt: testedAt,
        });
        return ok({ success, latencyMs, testedAt, message });
    }

    public async updateProxyOutbound(
        dto: {
            uuid: string;
            name?: string;
            description?: string | null;
            config?: ProxyOutboundConfig;
            isEnabled?: boolean;
        },
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<ProxyOutboundEntity>> {
        try {
            const { uuid, ...data } = dto;
            const existing = await this.proxyOutboundsRepository.findByUUID(uuid);
            if (!existing) return fail(ERRORS.PROXY_OUTBOUND_NOT_FOUND);
            const result = await this.proxyOutboundsRepository.update(uuid, {
                ...data,
                config: data.config
                    ? ProxyOutboundConfigSchema.parse(
                          mergeRedactedProxyConfig(data.config, existing.config),
                      )
                    : undefined,
            });
            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'proxy-outbound.update',
                resourceType: 'proxy-outbound',
                resourceId: result.uuid,
                result: 'success',
                message: `Updated proxy outbound "${result.name}".`,
            });
            return ok(redactProxyOutbound(result));
        } catch (error) {
            this.logger.error('Failed to update proxy outbound', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async deleteProxyOutbound(
        uuid: string,
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<boolean>> {
        try {
            const existing = await this.proxyOutboundsRepository.findByUUID(uuid);
            if (!existing) return fail(ERRORS.INTERNAL_SERVER_ERROR);
            const result = await this.proxyOutboundsRepository.deleteByUUID(uuid);
            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'proxy-outbound.delete',
                resourceType: 'proxy-outbound',
                resourceId: uuid,
                result: 'success',
                message: `Deleted proxy outbound "${existing.name}".`,
            });
            return ok(result);
        } catch (error) {
            this.logger.error('Failed to delete proxy outbound', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async update(
        dto: UpdateEgressRuleRequestDto,
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<EgressRuleEntity>> {
        try {
            const existing = await this.repository.findByUUID(dto.uuid);
            if (!existing) {
                return fail(ERRORS.INTERNAL_SERVER_ERROR); // Or specific NOT_FOUND error
            }

            const resolvedAction = dto.action ?? existing.action;
            const resolvedProxyOutboundUuid =
                dto.proxyOutboundUuid === undefined
                    ? existing.proxyOutboundUuid
                    : dto.proxyOutboundUuid;
            const resolvedProxyGroupUuid =
                dto.proxyGroupUuid === undefined ? existing.proxyGroupUuid : dto.proxyGroupUuid;
            if (
                resolvedAction === 'PROXY' &&
                !resolvedProxyOutboundUuid &&
                !resolvedProxyGroupUuid
            ) {
                return fail(ERRORS.INTERNAL_SERVER_ERROR);
            }

            const updated = await this.repository.update({
                uuid: dto.uuid,
                name: dto.name,
                description: dto.description,
                pattern: dto.pattern,
                action: dto.action,
                isEnabled: dto.isEnabled,
                targetUsers: dto.targetUsers,
                proxyOutboundUuid: resolvedAction === 'PROXY' ? resolvedProxyOutboundUuid : null,
                proxyGroupUuid: resolvedAction === 'PROXY' ? resolvedProxyGroupUuid : null,
                validFrom: dto.validFrom === undefined ? existing.validFrom : dto.validFrom,
                expiresAt: dto.expiresAt === undefined ? existing.expiresAt : dto.expiresAt,
            });

            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'egress-rule.update',
                resourceType: 'egress-rule',
                resourceId: dto.uuid,
                result: 'success',
                message: `Updated egress rule "${updated.name}".`,
                metadata: { before: existing, after: updated },
            });

            return ok(updated);
        } catch (error) {
            this.logger.error('Failed to update egress rule', error);
            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'egress-rule.update',
                resourceType: 'egress-rule',
                resourceId: dto.uuid,
                result: 'failed',
                message: `Failed to update egress rule: ${error instanceof Error ? error.message : String(error)}`,
            });
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async delete(
        uuid: string,
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<boolean>> {
        try {
            const existing = await this.repository.findByUUID(uuid);
            if (!existing) {
                return fail(ERRORS.INTERNAL_SERVER_ERROR);
            }

            const result = await this.repository.deleteByUUID(uuid);

            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'egress-rule.delete',
                resourceType: 'egress-rule',
                resourceId: uuid,
                result: 'success',
                message: `Deleted egress rule "${existing.name}".`,
                metadata: { rule: existing },
            });

            return ok(result);
        } catch (error) {
            this.logger.error('Failed to delete egress rule', error);
            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'egress-rule.delete',
                resourceType: 'egress-rule',
                resourceId: uuid,
                result: 'failed',
                message: `Failed to delete egress rule: ${error instanceof Error ? error.message : String(error)}`,
            });
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async reorder(
        uuids: string[],
        actorInfo?: { uuid: string; username: string | null },
    ): Promise<TResult<boolean>> {
        try {
            const result = await this.repository.reorder(uuids);

            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'egress-rule.reorder',
                resourceType: 'egress-rule',
                result: 'success',
                message: 'Reordered egress rules priority.',
                metadata: { order: uuids },
            });

            return ok(result);
        } catch (error) {
            this.logger.error('Failed to reorder egress rules', error);
            await this.auditLogsService.createLog({
                actorType: 'admin',
                actorId: actorInfo?.uuid,
                actorName: actorInfo?.username,
                action: 'egress-rule.reorder',
                resourceType: 'egress-rule',
                result: 'failed',
                message: `Failed to reorder egress rules: ${error instanceof Error ? error.message : String(error)}`,
            });
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    public async testRule(
        pattern: string,
    ): Promise<TResult<{ matched: boolean; rule: EgressRuleEntity | null }>> {
        try {
            const now = new Date();
            const enabledRules = (await this.repository.findByCriteria({ isEnabled: true })).filter(
                (rule) =>
                    (!rule.validFrom || rule.validFrom <= now) &&
                    (!rule.expiresAt || rule.expiresAt > now),
            );
            for (const rule of enabledRules) {
                if (matchPattern(pattern, rule.pattern)) {
                    return ok({
                        matched: true,
                        rule,
                    });
                }
            }
            return ok({
                matched: false,
                rule: null,
            });
        } catch (error) {
            this.logger.error('Failed to test rule', error);
            return fail(ERRORS.INTERNAL_SERVER_ERROR);
        }
    }

    private async injectLegacyEgressRulesIntoConfig(config: any): Promise<any> {
        try {
            if (!config) return config;

            // 1. 获取所有启用的规则
            const enabledRules = await this.repository.findByCriteria({ isEnabled: true });
            if (enabledRules.length === 0) {
                // 如果没有规则，但也检查并加上 sniffing
                this.injectSniffing(config);
                return config;
            }

            // 2. 确保 outbounds 中包含 BLOCK
            if (!config.outbounds) {
                config.outbounds = [];
            }
            const hasBlockOutbound = config.outbounds.some((o: any) => o.tag === 'BLOCK');
            if (!hasBlockOutbound) {
                config.outbounds.push({
                    tag: 'BLOCK',
                    protocol: 'blackhole',
                    settings: {
                        response: {
                            type: 'http',
                        },
                    },
                });
            }

            // 3. 寻找主代理的 tag (用于 ALLOW 规则)
            let proxyTag = 'proxy';
            const foundProxy = config.outbounds.find(
                (o: any) =>
                    o.protocol !== 'freedom' && o.protocol !== 'blackhole' && o.protocol !== 'dns',
            );
            if (foundProxy && foundProxy.tag) {
                proxyTag = foundProxy.tag;
            } else if (config.outbounds[0] && config.outbounds[0].tag) {
                proxyTag = config.outbounds[0].tag;
            }

            // 4. 将 egress rules 转换为 Xray Routing Rules
            const routingRules: any[] = [];
            for (const ruleEntity of enabledRules) {
                const rule: any = {
                    type: 'field',
                    outboundTag: ruleEntity.action === 'BLOCK' ? 'BLOCK' : proxyTag,
                };

                if (
                    ruleEntity.targetUsers &&
                    Array.isArray(ruleEntity.targetUsers) &&
                    ruleEntity.targetUsers.length > 0
                ) {
                    rule.user = ruleEntity.targetUsers.map(String);
                }

                const cleanPattern = ruleEntity.pattern.trim().toLowerCase();

                if (cleanPattern.startsWith('domain:')) {
                    rule.domain = [cleanPattern];
                } else if (cleanPattern.startsWith('geosite:')) {
                    rule.domain = [cleanPattern];
                } else if (cleanPattern.startsWith('regexp:')) {
                    rule.domain = [cleanPattern];
                } else if (cleanPattern.startsWith('keyword:')) {
                    rule.domain = [cleanPattern];
                } else if (cleanPattern.startsWith('full:')) {
                    rule.domain = [cleanPattern];
                } else if (cleanPattern.startsWith('geoip:')) {
                    rule.ip = [cleanPattern];
                } else if (cleanPattern.startsWith('ip:')) {
                    rule.ip = [cleanPattern.substring(3)];
                } else if (cleanPattern.startsWith('port:')) {
                    rule.port = cleanPattern.substring(5);
                } else if (cleanPattern.startsWith('protocol:')) {
                    rule.protocol = [cleanPattern.substring(9)];
                } else if (cleanPattern.startsWith('network:')) {
                    rule.network = cleanPattern.substring(8);
                } else {
                    if (cleanPattern.includes('/') && /^[0-9./]+$/.test(cleanPattern)) {
                        rule.ip = [cleanPattern];
                    } else if (/^[0-9.]+$/.test(cleanPattern)) {
                        rule.ip = [cleanPattern];
                    } else if (cleanPattern.includes('.')) {
                        rule.domain = [`domain:${cleanPattern}`];
                    } else {
                        rule.domain = [`keyword:${cleanPattern}`];
                    }
                }
                routingRules.push(rule);
            }

            // 5. 注入 routing.rules 到头部
            if (!config.routing) {
                config.routing = {};
            }
            if (!config.routing.rules) {
                config.routing.rules = [];
            }
            config.routing.rules = [...routingRules, ...config.routing.rules];

            // 6. 开启嗅探 (Sniffing)
            this.injectSniffing(config);

            return config;
        } catch (error) {
            this.logger.error('Failed to inject egress rules into config', error);
            return config;
        }
    }

    public async injectEgressRulesIntoConfig(config: any): Promise<any> {
        try {
            if (!config) return config;

            const now = new Date();
            const enabledRules = (await this.repository.findByCriteria({ isEnabled: true })).filter(
                (rule) =>
                    (!rule.validFrom || rule.validFrom <= now) &&
                    (!rule.expiresAt || rule.expiresAt > now),
            );
            this.injectSniffing(config);
            if (enabledRules.length === 0) return config;

            config.outbounds ??= [];
            config.routing ??= {};
            config.routing.rules ??= [];
            config.routing.balancers ??= [];

            if (!config.outbounds.some((outbound: any) => outbound.tag === 'BLOCK')) {
                config.outbounds.push({
                    tag: 'BLOCK',
                    protocol: 'blackhole',
                    settings: { response: { type: 'http' } },
                });
            }
            if (!config.outbounds.some((outbound: any) => outbound.tag === EGRESS_DIRECT_TAG)) {
                config.outbounds.push({
                    tag: EGRESS_DIRECT_TAG,
                    protocol: 'freedom',
                    settings: {},
                });
            }

            const proxyOutbounds = await this.proxyOutboundsRepository.findEnabled();
            const proxyOutboundsByUuid = new Map(
                proxyOutbounds.map((outbound) => [outbound.uuid, outbound]),
            );
            const proxyGroups = await this.proxyGroupsRepository.findEnabled();
            const proxyGroupsByUuid = new Map(proxyGroups.map((group) => [group.uuid, group]));
            const routingRules: any[] = [];

            for (const ruleEntity of enabledRules) {
                const outboundTag = egressRuleTag(ruleEntity.uuid);
                let balancerTag: string | undefined;
                if (ruleEntity.action === 'BLOCK') {
                    config.outbounds.push({
                        tag: outboundTag,
                        protocol: 'blackhole',
                        settings: { response: { type: 'http' } },
                    });
                } else if (ruleEntity.action === 'DIRECT') {
                    config.outbounds.push({
                        tag: outboundTag,
                        protocol: 'freedom',
                        settings: {},
                    });
                } else if (ruleEntity.action === 'PROXY') {
                    const proxyGroup = ruleEntity.proxyGroupUuid
                        ? proxyGroupsByUuid.get(ruleEntity.proxyGroupUuid)
                        : undefined;
                    if (proxyGroup) {
                        const members = proxyGroup.outboundUuids
                            .map((uuid) => proxyOutboundsByUuid.get(uuid))
                            .filter((outbound): outbound is ProxyOutboundEntity => !!outbound);
                        if (members.length === 0) {
                            this.logger.warn(
                                `Skipping egress rule ${ruleEntity.uuid}: proxy group has no enabled members.`,
                            );
                            continue;
                        }

                        if (proxyGroup.mode === 'FAILOVER') {
                            const selected =
                                members.find((outbound) => outbound.healthStatus === 'HEALTHY') ??
                                members[0];
                            config.outbounds.push(
                                buildProxyOutbound(
                                    {
                                        ...selected.config,
                                        enabled: true,
                                    } as ProxyChainConfig,
                                    outboundTag,
                                ),
                            );
                        } else {
                            const memberTags = members.map((member, index) => {
                                const memberTag = egressRuleMemberTag(ruleEntity.uuid, index);
                                config.outbounds.push(
                                    buildProxyOutbound(
                                        {
                                            ...member.config,
                                            enabled: true,
                                        } as ProxyChainConfig,
                                        memberTag,
                                    ),
                                );
                                return memberTag;
                            });
                            balancerTag = egressRuleBalancerTag(ruleEntity.uuid);
                            config.routing.balancers.push({
                                tag: balancerTag,
                                selector: memberTags,
                                strategy: { type: 'random' },
                            });
                        }
                    } else {
                        const proxyOutbound = ruleEntity.proxyOutboundUuid
                            ? proxyOutboundsByUuid.get(ruleEntity.proxyOutboundUuid)
                            : undefined;
                        if (!proxyOutbound) {
                            this.logger.warn(
                                `Skipping egress rule ${ruleEntity.uuid}: proxy outbound is missing or disabled.`,
                            );
                            continue;
                        }

                        config.outbounds.push(
                            buildProxyOutbound(
                                { ...proxyOutbound.config, enabled: true } as ProxyChainConfig,
                                outboundTag,
                            ),
                        );
                    }
                }

                const rule: any = balancerTag
                    ? { type: 'field', balancerTag }
                    : { type: 'field', outboundTag };
                if (ruleEntity.targetUsers?.length) {
                    rule.user = ruleEntity.targetUsers.map(String);
                }

                const cleanPattern = ruleEntity.pattern.trim().toLowerCase();
                if (
                    cleanPattern.startsWith('domain:') ||
                    cleanPattern.startsWith('geosite:') ||
                    cleanPattern.startsWith('regexp:') ||
                    cleanPattern.startsWith('keyword:') ||
                    cleanPattern.startsWith('full:')
                ) {
                    rule.domain = [cleanPattern];
                } else if (cleanPattern.startsWith('geoip:')) {
                    rule.ip = [cleanPattern];
                } else if (cleanPattern.startsWith('ip:')) {
                    rule.ip = [cleanPattern.substring(3)];
                } else if (cleanPattern.startsWith('port:')) {
                    rule.port = cleanPattern.substring(5);
                } else if (cleanPattern.startsWith('protocol:')) {
                    rule.protocol = [cleanPattern.substring(9)];
                } else if (cleanPattern.startsWith('network:')) {
                    rule.network = cleanPattern.substring(8);
                } else if (cleanPattern.includes('/') && /^[0-9./]+$/.test(cleanPattern)) {
                    rule.ip = [cleanPattern];
                } else if (/^[0-9.]+$/.test(cleanPattern)) {
                    rule.ip = [cleanPattern];
                } else {
                    rule.domain = [
                        cleanPattern.includes('.')
                            ? `domain:${cleanPattern}`
                            : `keyword:${cleanPattern}`,
                    ];
                }
                routingRules.push(rule);
            }

            config.routing.rules = [...routingRules, ...config.routing.rules];
            return config;
        } catch (error) {
            this.logger.error('Failed to inject egress rules into config', error);
            return config;
        }
    }

    private injectSniffing(config: any): void {
        if (!config.inbounds) return;
        for (const inbound of config.inbounds) {
            if (
                ['hysteria', 'hysteria2', 'shadowsocks', 'trojan', 'vless'].includes(
                    inbound.protocol,
                )
            ) {
                inbound.sniffing = {
                    enabled: true,
                    destOverride: ['http', 'tls', 'quic'],
                    metadataOnly: false,
                    routeOnly: false,
                    ...(inbound.sniffing || {}),
                };
                inbound.sniffing.enabled = true;
                inbound.sniffing.destOverride = ['http', 'tls', 'quic'];
            }
        }
    }
}
