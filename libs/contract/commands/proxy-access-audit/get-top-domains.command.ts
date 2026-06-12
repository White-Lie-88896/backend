import { z } from 'zod';

import { ProxyAccessTopDomainSchema } from '../../models';
import { PROXY_ACCESS_AUDIT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { ProxyAccessAuditStatsQuerySchema } from './shared';

export namespace GetProxyAccessTopDomainsCommand {
    export const url = REST_API.PROXY_ACCESS_AUDIT.TOP_DOMAINS;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        PROXY_ACCESS_AUDIT_ROUTES.TOP_DOMAINS,
        'get',
        'Get proxy access top domains',
        'Can only be used with admin JWT-token.',
    );

    export const RequestQuerySchema = ProxyAccessAuditStatsQuerySchema;
    export type RequestQuery = z.infer<typeof RequestQuerySchema>;

    export const ResponseSchema = z.object({
        response: z.array(ProxyAccessTopDomainSchema),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
