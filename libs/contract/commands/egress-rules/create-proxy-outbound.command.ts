import { z } from 'zod';

import { ProxyOutboundConfigSchema, ProxyOutboundSchema } from '../../models';
import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace CreateProxyOutboundCommand {
    export const url = REST_API.EGRESS_RULES.OUTBOUNDS.CREATE;
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.OUTBOUNDS.CREATE,
        'post',
        'Create a proxy outbound',
        'Can only be used with admin JWT-token.',
    );
    export const RequestSchema = z.object({
        name: z.string().min(1).max(128),
        description: z.string().nullable().optional(),
        config: ProxyOutboundConfigSchema,
        isEnabled: z.boolean().optional(),
    });
    export type Request = z.infer<typeof RequestSchema>;
    export const ResponseSchema = z.object({ response: ProxyOutboundSchema });
    export type Response = z.infer<typeof ResponseSchema>;
}
