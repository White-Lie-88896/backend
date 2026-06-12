import { z } from 'zod';

import { REST_API, EGRESS_RULES_ROUTES } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace ReorderEgressRulesCommand {
    export const url = REST_API.EGRESS_RULES.ACTIONS.REORDER;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.ACTIONS.REORDER,
        'post',
        'Reorder egress rules',
        'Can only be used with admin JWT-token.',
    );

    export const RequestSchema = z.object({
        uuids: z.array(z.string().uuid()),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.boolean(),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
