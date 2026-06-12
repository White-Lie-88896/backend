import { z } from 'zod';

import { REST_API, EGRESS_RULES_ROUTES } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace DeleteEgressRuleCommand {
    export const url = REST_API.EGRESS_RULES.DELETE;
    export const TSQ_url = url(':uuid');

    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.DELETE(':uuid'),
        'delete',
        'Delete an egress rule by UUID',
        'Can only be used with admin JWT-token.',
    );

    export const RequestSchema = z.object({
        uuid: z.string().uuid(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.boolean(),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
