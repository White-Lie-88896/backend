import { TBillingNodeNotificationType } from '../interfaces';

interface IInfraBillingNodeNotification {
    nodeName: string;
    providerName: string;
    loginUrl: string | null;
    nextBillingAt: Date;
    billingAmount: number;
    billingCurrency: string;
    notificationType?: TBillingNodeNotificationType;
}

export class InfraBillingNodeNotificationEntity {
    public readonly nodeName: string;
    public readonly providerName: string;
    public readonly loginUrl: string | null;
    public readonly nextBillingAt: Date;
    public readonly billingAmount: number;
    public readonly billingCurrency: string;
    public readonly notificationType?: TBillingNodeNotificationType;

    constructor(billingNode: IInfraBillingNodeNotification) {
        this.nodeName = billingNode.nodeName;
        this.providerName = billingNode.providerName;
        this.loginUrl = billingNode.loginUrl;
        this.nextBillingAt = billingNode.nextBillingAt;
        this.billingAmount = billingNode.billingAmount;
        this.billingCurrency = billingNode.billingCurrency;
        this.notificationType = billingNode.notificationType;
    }
}
