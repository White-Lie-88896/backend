import { z } from 'zod';

export const EGRESS_RULE_ACTIONS = ['BLOCK', 'DIRECT', 'PROXY'] as const;

export const EgressRuleSchema = z.object({
    uuid: z.string().uuid(),
    viewPosition: z.number().int(),
    name: z.string().max(128),
    description: z.string().nullable().optional(),
    pattern: z.string(),
    action: z.enum(EGRESS_RULE_ACTIONS),
    isEnabled: z.boolean(),
    targetUsers: z.nullable(z.array(z.number())).optional(),
    proxyOutboundUuid: z.string().uuid().nullable().optional(),
    proxyGroupUuid: z.string().uuid().nullable().optional(),
    validFrom: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    trafficUplinkBytes: z.string().default('0'),
    trafficDownlinkBytes: z.string().default('0'),
    trafficTotalBytes: z.string().default('0'),
    trafficHitCount: z.string().default('0'),
    lastTrafficHitAt: z.coerce.date().nullable().optional(),
    createdAt: z
        .string()
        .datetime()
        .transform((str) => new Date(str)),
    updatedAt: z
        .string()
        .datetime()
        .transform((str) => new Date(str)),
});

export type EgressRule = z.infer<typeof EgressRuleSchema>;
export type EgressRuleAction = (typeof EGRESS_RULE_ACTIONS)[number];
