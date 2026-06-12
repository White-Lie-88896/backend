import { z } from 'zod';

import { EgressRuleSchema, EGRESS_RULE_ACTIONS } from '../../models/egress-rule.schema';
import { REST_API, EGRESS_RULES_ROUTES } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace UpdateEgressRuleCommand {
    export const url = REST_API.EGRESS_RULES.UPDATE;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.UPDATE,
        'put',
        'Update an egress rule',
        'Can only be used with admin JWT-token.',
    );

    export const RequestSchema = z.object({
        uuid: z.string().uuid(),
        name: z.string().max(128).optional(),
        description: z.string().nullable().optional(),
        pattern: z.string().optional(),
        action: z.enum(EGRESS_RULE_ACTIONS).optional(),
        isEnabled: z.boolean().optional(),
        targetUsers: z.optional(z.nullable(z.array(z.number()))),
        proxyOutboundUuid: z.string().uuid().nullable().optional(),
        proxyGroupUuid: z.string().uuid().nullable().optional(),
        validFrom: z.coerce.date().nullable().optional(),
        expiresAt: z.coerce.date().nullable().optional(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: EgressRuleSchema,
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
