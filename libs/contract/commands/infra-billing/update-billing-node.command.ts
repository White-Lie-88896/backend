import { z } from 'zod';

import {
    InfraBillingAvailableNodeSchema,
    InfraBillingCycleSchema,
    InfraBillingCurrencySchema,
    InfraBillingNodeSchema,
    InfraBillingReminderDaysSchema,
    InfraBillingStatsSchema,
} from '../../models';
import { INFRA_BILLING_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace UpdateInfraBillingNodeCommand {
    export const url = REST_API.INFRA_BILLING.UPDATE_BILLING_NODE;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        INFRA_BILLING_ROUTES.UPDATE_BILLING_NODE,
        'patch',
        'Update infra billing nodes',
    );

    export const RequestSchema = z
        .object({
            uuids: z.array(z.string().uuid()).min(1),
            billingAmount: z.coerce.number().min(0).optional(),
            billingCycle: InfraBillingCycleSchema.optional(),
            billingCurrency: InfraBillingCurrencySchema.optional(),
            reminderDays: InfraBillingReminderDaysSchema.optional(),
            nextBillingAt: z
                .string({
                    invalid_type_error: 'Invalid date format',
                })
                .datetime({ message: 'Invalid date format', offset: true, local: true })
                .transform((str) => new Date(str))
                .optional(),
        })
        .refine(
            ({ billingAmount, billingCycle, billingCurrency, reminderDays, nextBillingAt }) =>
                billingAmount !== undefined ||
                billingCycle !== undefined ||
                billingCurrency !== undefined ||
                reminderDays !== undefined ||
                nextBillingAt !== undefined,
            {
                message: 'At least one field must be provided',
            },
        );

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            totalBillingNodes: z.number(),
            billingNodes: z.array(InfraBillingNodeSchema),
            availableBillingNodes: z.array(InfraBillingAvailableNodeSchema),
            totalAvailableBillingNodes: z.number(),
            stats: InfraBillingStatsSchema,
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
