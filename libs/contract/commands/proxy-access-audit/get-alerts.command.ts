import { z } from 'zod';

import {
    PROXY_ACCESS_ALERT_SEVERITIES,
    PROXY_ACCESS_ALERT_STATUSES,
    PROXY_ACCESS_ALERT_TYPES,
    ProxyAccessAlertSchema,
    TanstackQueryRequestQuerySchema,
} from '../../models';
import { PROXY_ACCESS_AUDIT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace GetProxyAccessAlertsCommand {
    export const url = REST_API.PROXY_ACCESS_AUDIT.ALERTS;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        PROXY_ACCESS_AUDIT_ROUTES.ALERTS,
        'get',
        'Get proxy access audit alerts',
        'Can only be used with admin JWT-token.',
    );

    export const RequestQuerySchema = TanstackQueryRequestQuerySchema.extend({
        startTime: z.string().datetime({ offset: true }).optional(),
        endTime: z.string().datetime({ offset: true }).optional(),
        type: z.enum(PROXY_ACCESS_ALERT_TYPES).optional(),
        severity: z.enum(PROXY_ACCESS_ALERT_SEVERITIES).optional(),
        status: z.enum(PROXY_ACCESS_ALERT_STATUSES).optional(),
        user: z.string().max(128).optional(),
        nodeUuid: z.string().uuid().optional(),
        target: z.string().max(255).optional(),
    });

    export type RequestQuery = z.infer<typeof RequestQuerySchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            records: z.array(ProxyAccessAlertSchema),
            total: z.number(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
