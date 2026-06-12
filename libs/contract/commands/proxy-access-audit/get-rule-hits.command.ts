import { z } from 'zod';

import { ProxyAccessRuleHitSchema } from '../../models';
import { PROXY_ACCESS_AUDIT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { ProxyAccessAuditStatsQuerySchema } from './shared';

export namespace GetProxyAccessRuleHitsCommand {
    export const url = REST_API.PROXY_ACCESS_AUDIT.RULE_HITS;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        PROXY_ACCESS_AUDIT_ROUTES.RULE_HITS,
        'get',
        'Get proxy access rule hit stats',
        'Can only be used with admin JWT-token.',
    );

    export const RequestQuerySchema = ProxyAccessAuditStatsQuerySchema;
    export type RequestQuery = z.infer<typeof RequestQuerySchema>;

    export const ResponseSchema = z.object({
        response: z.array(ProxyAccessRuleHitSchema),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
