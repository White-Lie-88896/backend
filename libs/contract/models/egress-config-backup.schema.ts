import { z } from 'zod';

import { ProxyOutboundConfigSchema } from './proxy-outbound.schema';
import { EGRESS_RULE_ACTIONS } from './egress-rule.schema';
import { PROXY_GROUP_MODES } from './proxy-group.schema';

export const REDACTED_PROXY_SECRET = '__REDACTED__';

export const EgressConfigBackupSchema = z.object({
    format: z.literal('remnawave-egress-config'),
    version: z.literal(1),
    exportedAt: z.coerce.date(),
    includesSecrets: z.boolean(),
    proxyOutbounds: z.array(
        z.object({
            uuid: z.string().uuid(),
            name: z.string().min(1).max(128),
            description: z.string().nullable(),
            config: ProxyOutboundConfigSchema,
            isEnabled: z.boolean(),
        }),
    ),
    proxyGroups: z.array(
        z.object({
            uuid: z.string().uuid(),
            name: z.string().min(1).max(128),
            description: z.string().nullable(),
            mode: z.enum(PROXY_GROUP_MODES),
            outboundUuids: z.array(z.string().uuid()).min(1),
            isEnabled: z.boolean(),
        }),
    ),
    rules: z.array(
        z.object({
            uuid: z.string().uuid(),
            viewPosition: z.number().int(),
            name: z.string().min(1).max(128),
            description: z.string().nullable(),
            pattern: z.string().min(1),
            action: z.enum(EGRESS_RULE_ACTIONS),
            isEnabled: z.boolean(),
            targetUsers: z.array(z.number()).nullable(),
            proxyOutboundUuid: z.string().uuid().nullable(),
            proxyGroupUuid: z.string().uuid().nullable(),
            validFrom: z.coerce.date().nullable(),
            expiresAt: z.coerce.date().nullable(),
        }),
    ),
});

export type EgressConfigBackup = z.infer<typeof EgressConfigBackupSchema>;
