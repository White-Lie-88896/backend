import { z } from 'zod';

import { ProxyAccessLogIngestItemSchema } from '../../models';
import { PROXY_ACCESS_AUDIT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace IngestProxyAccessLogsCommand {
    export const url = REST_API.PROXY_ACCESS_AUDIT.INGEST;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        PROXY_ACCESS_AUDIT_ROUTES.INGEST,
        'post',
        'Ingest proxy access audit logs',
        'Can be used with admin JWT-token or API-token.',
    );

    export const RequestSchema = z.object({
        logs: z.array(ProxyAccessLogIngestItemSchema).min(1).max(1000),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            accepted: z.number(),
            alertsCreated: z.number(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
