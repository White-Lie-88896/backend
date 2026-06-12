import { z } from 'zod';

import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace TestProxyOutboundCommand {
    export const url = REST_API.EGRESS_RULES.OUTBOUNDS.TEST;
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.OUTBOUNDS.TEST,
        'post',
        'Test proxy outbound TCP connectivity',
        'Can only be used with admin JWT-token.',
    );
    export const RequestSchema = z.object({ uuid: z.string().uuid() });
    export type Request = z.infer<typeof RequestSchema>;
    export const ResponseSchema = z.object({
        response: z.object({
            success: z.boolean(),
            latencyMs: z.number().int().nonnegative().nullable(),
            testedAt: z.coerce.date(),
            message: z.string(),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}
