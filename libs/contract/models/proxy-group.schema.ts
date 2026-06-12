import { z } from 'zod';

export const PROXY_GROUP_MODES = ['FAILOVER', 'RANDOM'] as const;

export const ProxyGroupSchema = z.object({
    uuid: z.string().uuid(),
    name: z.string().min(1).max(128),
    description: z.string().nullable(),
    mode: z.enum(PROXY_GROUP_MODES),
    outboundUuids: z.array(z.string().uuid()).min(1),
    isEnabled: z.boolean(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type ProxyGroup = z.infer<typeof ProxyGroupSchema>;
export type ProxyGroupMode = (typeof PROXY_GROUP_MODES)[number];
