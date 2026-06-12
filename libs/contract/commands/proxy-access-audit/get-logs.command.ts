import { z } from 'zod';

import { ProxyAccessLogSchema } from '../../models';
import { PROXY_ACCESS_AUDIT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { ProxyAccessAuditListQuerySchema } from './shared';

export namespace GetProxyAccessLogsCommand {
    export const url = REST_API.PROXY_ACCESS_AUDIT.LOGS;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        PROXY_ACCESS_AUDIT_ROUTES.LOGS,
        'get',
        'Get proxy access logs',
        'Can only be used with admin JWT-token.',
    );

    export const RequestQuerySchema = ProxyAccessAuditListQuerySchema;
    export type RequestQuery = z.infer<typeof RequestQuerySchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            records: z.array(ProxyAccessLogSchema),
            total: z.number(),
            aggregateOnly: z.boolean(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
