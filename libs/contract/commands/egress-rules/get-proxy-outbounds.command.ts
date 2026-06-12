import { z } from 'zod';

import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { ProxyOutboundSchema } from '../../models';

export namespace GetProxyOutboundsCommand {
    export const url = REST_API.EGRESS_RULES.OUTBOUNDS.GET;
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.OUTBOUNDS.GET,
        'get',
        'Get proxy outbounds',
        'Can only be used with admin JWT-token.',
    );
    export const ResponseSchema = z.object({ response: z.array(ProxyOutboundSchema) });
    export type Response = z.infer<typeof ResponseSchema>;
}
