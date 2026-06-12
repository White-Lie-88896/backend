import { z } from 'zod';

import { EgressRuleSchema } from '../../models/egress-rule.schema';
import { REST_API, EGRESS_RULES_ROUTES } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace TestEgressRuleCommand {
    export const url = REST_API.EGRESS_RULES.TEST;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.TEST,
        'post',
        'Test egress rule pattern matching',
        'Can only be used with admin JWT-token.',
    );

    export const RequestSchema = z.object({
        pattern: z.string(), // e.g. "google.com", "1.1.1.1", "BitTorrent"
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            matched: z.boolean(),
            rule: EgressRuleSchema.nullable(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
