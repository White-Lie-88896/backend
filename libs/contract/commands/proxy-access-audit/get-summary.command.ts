import { z } from 'zod';

import { ProxyAccessSummarySchema } from '../../models';
import { PROXY_ACCESS_AUDIT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { ProxyAccessAuditBaseQuerySchema } from './shared';

export namespace GetProxyAccessSummaryCommand {
    export const url = REST_API.PROXY_ACCESS_AUDIT.SUMMARY;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        PROXY_ACCESS_AUDIT_ROUTES.SUMMARY,
        'get',
        'Get proxy access audit summary',
        'Can only be used with admin JWT-token.',
    );

    export const RequestQuerySchema = ProxyAccessAuditBaseQuerySchema;
    export type RequestQuery = z.infer<typeof RequestQuerySchema>;

    export const ResponseSchema = z.object({
        response: ProxyAccessSummarySchema,
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
