import { z } from 'zod';

import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace DeleteProxyGroupCommand {
    export const url = REST_API.EGRESS_RULES.GROUPS.DELETE(':uuid');
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.GROUPS.DELETE(':uuid'),
        'delete',
        'Delete a proxy group',
        'Can only be used with admin JWT-token.',
    );
    export const RequestSchema = z.object({ uuid: z.string().uuid() });
    export type Request = z.infer<typeof RequestSchema>;
    export const ResponseSchema = z.object({ response: z.boolean() });
    export type Response = z.infer<typeof ResponseSchema>;
}
