import { z } from 'zod';

import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { EGRESS_RULE_ACTIONS } from '../../models';
import { getEndpointDetails } from '../../constants';

export namespace ImportEgressRuleListCommand {
    export const url = REST_API.EGRESS_RULES.ACTIONS.IMPORT_RULE_LIST;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.ACTIONS.IMPORT_RULE_LIST,
        'post',
        'Import a Clash-compatible egress rule list',
        'Creates one egress rule per supported, unique list entry.',
    );

    export const RequestSchema = z
        .object({
            sourceType: z.enum(['URL', 'TEXT']),
            source: z.string().min(1).max(2_000_000),
            namePrefix: z.string().min(1).max(80),
            action: z.enum(EGRESS_RULE_ACTIONS),
            dryRun: z.boolean().optional(),
            isEnabled: z.boolean().optional(),
            targetUsers: z.optional(z.nullable(z.array(z.number()))),
            proxyOutboundUuid: z.string().uuid().nullable().optional(),
            proxyGroupUuid: z.string().uuid().nullable().optional(),
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
            if (data.sourceType === 'URL') {
                try {
                    const url = new URL(data.source);
                    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
                } catch {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'A valid HTTP or HTTPS URL is required.',
                        path: ['source'],
                    });
                }
            }
        });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            created: z.number().int().nonnegative(),
            duplicates: z.number().int().nonnegative(),
            existingConflicts: z.number().int().nonnegative(),
            internalDuplicates: z.number().int().nonnegative(),
            parsed: z.number().int().nonnegative(),
            preview: z.array(
                z.object({
                    name: z.string(),
                    pattern: z.string(),
                    duplicate: z.boolean(),
                }),
            ),
            skipped: z.number().int().nonnegative(),
            unsupported: z.number().int().nonnegative(),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}
