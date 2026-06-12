import { InfraBillingNodes } from '@prisma/client';

import { NodesEntity } from '@modules/nodes/entities';

import { InfraProviderEntity } from './infra-provider.entity';

export type TInfraBillingCycle = 'MONTHLY' | 'YEARLY';
export type TInfraBillingCurrency = 'USD' | 'CNY' | 'EUR';

export class InfraBillingNodeEntity implements InfraBillingNodes {
    public uuid: string;
    public nodeUuid: string;
    public providerUuid: string;
    public nextBillingAt: Date;
    public billingAmount: number;
    public billingCycle: TInfraBillingCycle;
    public billingCurrency: TInfraBillingCurrency;
    public reminderDays: number[];

    public createdAt: Date;
    public updatedAt: Date;

    public provider: Pick<InfraProviderEntity, 'uuid' | 'name' | 'faviconLink' | 'loginUrl'>;
    public node: Pick<NodesEntity, 'uuid' | 'name' | 'countryCode'>;

    constructor(billingNode: Partial<InfraBillingNodes>) {
        Object.assign(this, billingNode);
        this.billingCurrency = (billingNode.billingCurrency as TInfraBillingCurrency) ?? 'USD';
        this.reminderDays = billingNode.reminderDays ?? [7, 3, 0];
        return this;
    }
}
