import { z } from 'zod';

import { PartialInfraProviderSchema } from './infra-provider.schema';
import { NodesSchema } from './nodes.schema';

export const InfraBillingCycleSchema = z.enum(['MONTHLY', 'YEARLY']);
export const InfraBillingCurrencySchema = z.enum(['USD', 'CNY', 'EUR']);
export const InfraBillingReminderDaysSchema = z.array(z.number().int()).default([7, 3, 0]);

export const InfraBillingRenewalCostByCurrencySchema = z.object({
    currency: InfraBillingCurrencySchema,
    monthlyRenewalCost: z.number(),
    yearlyRenewalCost: z.number(),
});

export const InfraBillingStatsSchema = z.object({
    upcomingNodesCount: z.number(),
    dueSoonNodesCount: z.number(),
    overdueNodesCount: z.number(),
    monthlyRenewalCost: z.number(),
    yearlyRenewalCost: z.number(),
    currentMonthPayments: z.number(),
    totalSpent: z.number(),
    renewalCostsByCurrency: z.array(InfraBillingRenewalCostByCurrencySchema),
});

export const InfraBillingNodeSchema = z.object({
    uuid: z.string().uuid(),
    nodeUuid: z.string().uuid(),
    providerUuid: z.string().uuid(),
    billingAmount: z.number(),
    billingCycle: InfraBillingCycleSchema,
    billingCurrency: InfraBillingCurrencySchema.default('USD'),
    reminderDays: InfraBillingReminderDaysSchema,
    provider: PartialInfraProviderSchema.pick({
        uuid: true,
        name: true,
        loginUrl: true,
        faviconLink: true,
    }),

    node: NodesSchema.pick({
        uuid: true,
        name: true,
        countryCode: true,
    }),
    nextBillingAt: z
        .string()
        .datetime()
        .transform((str) => new Date(str)),

    createdAt: z
        .string()
        .datetime()
        .transform((str) => new Date(str)),
    updatedAt: z
        .string()
        .datetime()
        .transform((str) => new Date(str)),
});
