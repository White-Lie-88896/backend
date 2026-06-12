import { z } from 'zod';

import { EgressRuleSchema, EGRESS_RULE_ACTIONS } from '../../models/egress-rule.schema';
import { REST_API, EGRESS_RULES_ROUTES } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace CreateEgressRuleCommand {
    export const url = REST_API.EGRESS_RULES.CREATE;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.CREATE,
        'post',
        'Create a new egress rule',
        'Can only be used with admin JWT-token.',
    );

    export const RequestSchema = z
        .object({
            name: z.string().max(128),
            description: z.string().nullable().optional(),
            pattern: z.string(),
            action: z.enum(EGRESS_RULE_ACTIONS),
            isEnabled: z.boolean().optional(),
            targetUsers: z.optional(z.nullable(z.array(z.number()))),
            proxyOutboundUuid: z.string().uuid().nullable().optional(),
            proxyGroupUuid: z.string().uuid().nullable().optional(),
            validFrom: z.coerce.date().nullable().optional(),
            expiresAt: z.coerce.date().nullable().optional(),
        })
        .superRefine((data, context) => {
            if (data.action === 'PROXY' && !data.proxyOutboundUuid && !data.proxyGroupUuid) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Proxy outbound or proxy group is required for PROXY rules.',
                    path: ['proxyOutboundUuid'],
                });
            }
            if (data.proxyOutboundUuid && data.proxyGroupUuid) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Select either a proxy outbound or a proxy group.',
                    path: ['proxyGroupUuid'],
                });
            }
            if (data.validFrom && data.expiresAt && data.expiresAt <= data.validFrom) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Expiration must be later than the start time.',
                    path: ['expiresAt'],
                });
            }
        });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: EgressRuleSchema,
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
