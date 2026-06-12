import { z } from 'zod';

import { ProxyOutboundConfigSchema, ProxyOutboundSchema } from '../../models';
import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace UpdateProxyOutboundCommand {
    export const url = REST_API.EGRESS_RULES.OUTBOUNDS.UPDATE;
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.OUTBOUNDS.UPDATE,
        'put',
        'Update a proxy outbound',
        'Can only be used with admin JWT-token.',
    );
    export const RequestSchema = z.object({
        uuid: z.string().uuid(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().nullable().optional(),
        config: ProxyOutboundConfigSchema.optional(),
        isEnabled: z.boolean().optional(),
        distributionMode: z.enum(['INHERIT', 'NONE', 'ALL', 'SELECTED']).optional(),
        targetUserIds: z.array(z.number().int().positive()).optional(),
        targetSquadUuids: z.array(z.string().uuid()).optional(),
    });
    export type Request = z.infer<typeof RequestSchema>;
    export const ResponseSchema = z.object({ response: ProxyOutboundSchema });
    export type Response = z.infer<typeof ResponseSchema>;
}
