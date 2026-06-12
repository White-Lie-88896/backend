import { z } from 'zod';

import { TanstackQueryRequestQuerySchema } from '../../models';

export const ProxyAccessAuditBaseQuerySchema = z.object({
    startTime: z.string().datetime({ offset: true }).optional(),
    endTime: z.string().datetime({ offset: true }).optional(),
    user: z.string().max(128).optional(),
    nodeUuid: z.string().uuid().optional(),
    target: z.string().max(255).optional(),
    targetPort: z.coerce.number().int().min(1).max(65_535).optional(),
    protocol: z.string().max(32).optional(),
    outboundTag: z.string().max(128).optional(),
    ruleUuid: z.string().uuid().optional(),
});

export const ProxyAccessAuditListQuerySchema =
    TanstackQueryRequestQuerySchema.merge(ProxyAccessAuditBaseQuerySchema);

export const ProxyAccessAuditStatsQuerySchema = ProxyAccessAuditBaseQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
