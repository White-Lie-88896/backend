import { z } from 'zod';

import { EgressRuleSchema } from '../../models/egress-rule.schema';
import { REST_API, EGRESS_RULES_ROUTES } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace FindAllEgressRulesCommand {
    export const url = REST_API.EGRESS_RULES.GET;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.GET,
        'get',
        'Get all egress rules',
        'Can only be used with admin JWT-token.',
    );

    export const ResponseSchema = z.object({
        response: z.array(EgressRuleSchema),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
