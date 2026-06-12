import { z } from 'zod';

import { PROXY_GROUP_MODES, ProxyGroupSchema } from '../../models';
import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace CreateProxyGroupCommand {
    export const url = REST_API.EGRESS_RULES.GROUPS.CREATE;
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.GROUPS.CREATE,
        'post',
        'Create a proxy group',
        'Can only be used with admin JWT-token.',
    );
    export const RequestSchema = z.object({
        name: z.string().min(1).max(128),
        description: z.string().nullable().optional(),
        mode: z.enum(PROXY_GROUP_MODES),
        outboundUuids: z.array(z.string().uuid()).min(1),
        isEnabled: z.boolean().optional(),
    });
    export type Request = z.infer<typeof RequestSchema>;
    export const ResponseSchema = z.object({ response: ProxyGroupSchema });
    export type Response = z.infer<typeof ResponseSchema>;
}
