import { z } from 'zod';

import { AuditLogSchema, TanstackQueryRequestQuerySchema } from '../../models';
import { AUDIT_LOGS_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace GetAuditLogsCommand {
    export const url = REST_API.AUDIT_LOGS.GET;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        AUDIT_LOGS_ROUTES.GET,
        'get',
        'Get audit logs',
    );

    export const RequestQuerySchema = TanstackQueryRequestQuerySchema.extend({
        startTime: z.string().datetime({ offset: true }).optional(),
        endTime: z.string().datetime({ offset: true }).optional(),
        actorType: z.string().max(32).optional(),
        actorName: z.string().max(128).optional(),
        action: z.string().max(128).optional(),
        resourceType: z.string().max(64).optional(),
        result: z.string().max(32).optional(),
        ip: z.string().max(64).optional(),
    });

    export type RequestQuery = z.infer<typeof RequestQuerySchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            records: z.array(AuditLogSchema),
            total: z.number(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
