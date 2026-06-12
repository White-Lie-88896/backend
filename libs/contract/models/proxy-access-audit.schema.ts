import { z } from 'zod';

export const PROXY_ACCESS_ALERT_TYPES = [
    'DISTINCT_DOMAINS',
    'HIGH_RISK_PORT',
    'NODE_TRAFFIC_SPIKE',
    'BLACKLIST_HIT',
] as const;

export const PROXY_ACCESS_ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export const PROXY_ACCESS_ALERT_STATUSES = ['OPEN', 'ACKED', 'RESOLVED'] as const;

const nullableDateSchema = z
    .string()
    .datetime()
    .nullable()
    .transform((value) => (value ? new Date(value) : null));

export const ByteStringSchema = z.coerce.string().regex(/^\d+$/);

export const ProxyAccessLogSchema = z.object({
    id: z.string().uuid(),
    occurredAt: z
        .string()
        .datetime()
        .transform((value) => new Date(value)),
    createdAt: z
        .string()
        .datetime()
        .transform((value) => new Date(value)),
    nodeUuid: z.string().uuid().nullable(),
    nodeName: z.string().nullable(),
    userId: z.string().nullable(),
    userUuid: z.string().uuid().nullable(),
    username: z.string().nullable(),
    targetHost: z.string(),
    targetIp: z.string().nullable(),
    targetPort: z.number().nullable(),
    protocol: z.string().nullable(),
    network: z.string().nullable(),
    inboundTag: z.string().nullable(),
    outboundTag: z.string().nullable(),
    ruleUuid: z.string().uuid().nullable(),
    ruleName: z.string().nullable(),
    ruleAction: z.string().nullable(),
    uplinkBytes: ByteStringSchema,
    downlinkBytes: ByteStringSchema,
    totalBytes: ByteStringSchema,
    sessionId: z.string().nullable(),
    metadata: z.unknown().nullable(),
});

export const ProxyAccessLogIngestItemSchema = z.object({
    occurredAt: z.string().datetime({ offset: true }).optional(),
    nodeUuid: z.string().uuid().optional(),
    nodeName: z.string().max(128).optional(),
    userId: ByteStringSchema.optional(),
    userUuid: z.string().uuid().optional(),
    username: z.string().max(128).optional(),
    targetHost: z.string().trim().min(1).max(255),
    targetIp: z.string().max(64).optional(),
    targetPort: z.coerce.number().int().min(1).max(65_535).optional(),
    protocol: z.string().max(32).optional(),
    network: z.string().max(16).optional(),
    inboundTag: z.string().max(128).optional(),
    outboundTag: z.string().max(128).optional(),
    ruleUuid: z.string().uuid().optional(),
    ruleName: z.string().max(128).optional(),
    ruleAction: z.string().max(32).optional(),
    uplinkBytes: ByteStringSchema.optional(),
    downlinkBytes: ByteStringSchema.optional(),
    totalBytes: ByteStringSchema.optional(),
    sessionId: z.string().max(128).optional(),
    metadata: z.record(z.unknown()).optional(),
});

export const ProxyAccessAuditSettingsSchema = z.object({
    id: z.number(),
    isEnabled: z.boolean(),
    retentionDays: z.number(),
    hideUsernames: z.boolean(),
    aggregateOnly: z.boolean(),
    distinctDomainWindowMinutes: z.number(),
    distinctDomainThreshold: z.number(),
    highRiskPorts: z.array(z.number()),
    nodeSpikeMultiplier: z.number(),
    nodeSpikeMinBytes: ByteStringSchema,
    blacklistedHosts: z.array(z.string()),
    blacklistedIps: z.array(z.string()),
    createdAt: z
        .string()
        .datetime()
        .transform((value) => new Date(value)),
    updatedAt: z
        .string()
        .datetime()
        .transform((value) => new Date(value)),
});

export const ProxyAccessSummarySchema = z.object({
    totalLogs: z.number(),
    totalBytes: ByteStringSchema,
    uplinkBytes: ByteStringSchema,
    downlinkBytes: ByteStringSchema,
    uniqueUsers: z.number(),
    uniqueDomains: z.number(),
    uniqueNodes: z.number(),
    alertCount: z.number(),
});

export const ProxyAccessTopDomainSchema = z.object({
    targetHost: z.string(),
    hits: z.number(),
    totalBytes: ByteStringSchema,
    uplinkBytes: ByteStringSchema,
    downlinkBytes: ByteStringSchema,
    uniqueUsers: z.number(),
    uniqueNodes: z.number(),
    lastSeenAt: nullableDateSchema,
});

export const ProxyAccessRuleHitSchema = z.object({
    ruleUuid: z.string().uuid().nullable(),
    ruleName: z.string().nullable(),
    ruleAction: z.string().nullable(),
    hitCount: z.number(),
    cumulativeHitCount: ByteStringSchema,
    uplinkBytes: ByteStringSchema,
    downlinkBytes: ByteStringSchema,
    totalBytes: ByteStringSchema,
    uniqueUsers: z.number(),
    uniqueNodes: z.number(),
    lastHitAt: nullableDateSchema,
});

export const ProxyAccessAlertSchema = z.object({
    id: z.string().uuid(),
    createdAt: z
        .string()
        .datetime()
        .transform((value) => new Date(value)),
    type: z.enum(PROXY_ACCESS_ALERT_TYPES),
    severity: z.enum(PROXY_ACCESS_ALERT_SEVERITIES),
    status: z.enum(PROXY_ACCESS_ALERT_STATUSES),
    message: z.string(),
    userId: z.string().nullable(),
    userUuid: z.string().uuid().nullable(),
    username: z.string().nullable(),
    nodeUuid: z.string().uuid().nullable(),
    nodeName: z.string().nullable(),
    targetHost: z.string().nullable(),
    targetIp: z.string().nullable(),
    targetPort: z.number().nullable(),
    metadata: z.unknown().nullable(),
});

export type ProxyAccessAlertSeverity = (typeof PROXY_ACCESS_ALERT_SEVERITIES)[number];
export type ProxyAccessAlertStatus = (typeof PROXY_ACCESS_ALERT_STATUSES)[number];
export type ProxyAccessAlertType = (typeof PROXY_ACCESS_ALERT_TYPES)[number];
