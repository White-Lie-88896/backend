import { z } from 'zod';

import { PROXY_ACCESS_AUDIT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace CleanupProxyAccessAuditCommand {
    export const url = REST_API.PROXY_ACCESS_AUDIT.CLEANUP;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        PROXY_ACCESS_AUDIT_ROUTES.CLEANUP,
        'post',
        'Cleanup proxy access audit logs',
        'Can only be used with admin JWT-token.',
    );

    export const RequestSchema = z.object({
        retentionDays: z.coerce.number().int().min(1).max(365).optional(),
        deleteAll: z.boolean().optional(),
        clearAlerts: z.boolean().optional(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            deletedLogs: z.number(),
            deletedAlerts: z.number(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
