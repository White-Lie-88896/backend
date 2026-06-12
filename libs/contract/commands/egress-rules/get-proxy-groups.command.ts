import { z } from 'zod';

import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { ProxyGroupSchema } from '../../models';

export namespace GetProxyGroupsCommand {
    export const url = REST_API.EGRESS_RULES.GROUPS.GET;
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.GROUPS.GET,
        'get',
        'Get proxy groups',
        'Can only be used with admin JWT-token.',
    );
    export const ResponseSchema = z.object({ response: z.array(ProxyGroupSchema) });
    export type Response = z.infer<typeof ResponseSchema>;
}
