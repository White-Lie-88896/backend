import { z } from 'zod';

export const PROXY_OUTBOUND_PROTOCOLS = [
    'socks5',
    'http',
    'shadowsocks',
    'vless',
    'vmess',
    'trojan',
] as const;

export const ProxyOutboundConfigSchema = z
    .object({
        protocol: z.enum(PROXY_OUTBOUND_PROTOCOLS),
        address: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        username: z.string().optional(),
        password: z.string().optional(),
        method: z.string().optional(),
        uuid: z.string().optional(),
        flow: z.string().optional(),
        alterId: z.number().int().min(0).optional(),
        security: z.string().optional(),
        network: z.enum(['tcp', 'ws', 'grpc', 'xhttp', 'h2']).optional(),
        tlsSecurity: z.enum(['none', 'tls', 'reality']).optional(),
        sni: z.string().optional(),
        fingerprint: z.string().optional(),
        realityPublicKey: z.string().optional(),
        realityShortId: z.string().optional(),
        realitySpiderX: z.string().optional(),
        allowInsecure: z.boolean().optional(),
        wsPath: z.string().optional(),
        wsHost: z.string().optional(),
        grpcServiceName: z.string().optional(),
    })
    .superRefine((config, context) => {
        if (['vless', 'vmess'].includes(config.protocol) && !config.uuid) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'UUID is required for VLESS and VMess.',
                path: ['uuid'],
            });
        }
        if (['shadowsocks', 'trojan'].includes(config.protocol) && !config.password) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Password is required for Trojan and Shadowsocks.',
                path: ['password'],
            });
        }
        if (config.tlsSecurity === 'reality' && !config.realityPublicKey) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Reality public key is required.',
                path: ['realityPublicKey'],
            });
        }
    });

export const ProxyOutboundSchema = z.object({
    uuid: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    config: ProxyOutboundConfigSchema,
    isEnabled: z.boolean(),
    healthStatus: z.enum(['UNKNOWN', 'HEALTHY', 'UNHEALTHY']),
    lastLatencyMs: z.number().int().nonnegative().nullable(),
    lastHealthMessage: z.string().nullable(),
    lastHealthCheckAt: z.coerce.date().nullable(),
    subscriptionUuid: z.string().uuid().nullable(),
    sourceKey: z.string().nullable(),
    distributionMode: z.enum(['INHERIT', 'NONE', 'ALL', 'SELECTED']),
    targetUserIds: z.array(z.number().int().positive()),
    targetSquadUuids: z.array(z.string().uuid()),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type ProxyOutboundConfig = z.infer<typeof ProxyOutboundConfigSchema>;
export type ProxyOutbound = z.infer<typeof ProxyOutboundSchema>;

export const ProxySubscriptionSchema = z.object({
    uuid: z.string().uuid(),
    name: z.string(),
    url: z.string().url(),
    isEnabled: z.boolean(),
    updateIntervalMin: z.number().int().min(15),
    lastSyncAt: z.coerce.date().nullable(),
    lastSyncStatus: z.enum(['NEVER', 'SUCCESS', 'FAILED']),
    lastSyncMessage: z.string().nullable(),
    distributionMode: z.enum(['NONE', 'ALL', 'SELECTED']),
    targetUserIds: z.array(z.number().int().positive()),
    targetSquadUuids: z.array(z.string().uuid()),
    nodeCount: z.number().int().nonnegative().default(0),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type ProxySubscription = z.infer<typeof ProxySubscriptionSchema>;
