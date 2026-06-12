import dayjs from 'dayjs';

import { EVENTS, TCRMEvents } from '@libs/contracts/constants';

import { CrmEvent } from '@integration-modules/notifications/interfaces';

export type CrmEventsTemplate = (event: CrmEvent) => string | null;

const formatAmount = (event: CrmEvent): string | null => {
    if (typeof event.data.billingAmount !== 'number') {
        return null;
    }

    return `${event.data.billingAmount.toFixed(2)} ${event.data.billingCurrency ?? 'USD'}`;
};

const paymentInfo = (event: CrmEvent): string => {
    const amount = formatAmount(event);

    return [
        `<b>Provider:</b> <code>${event.data.providerName}</code>`,
        `<b>Node:</b> <code>${event.data.nodeName}</code>`,
        `<b>Due Date:</b> <code>${dayjs(event.data.nextBillingAt).format('DD.MM.YYYY')}</code>`,
        amount ? `<b>Amount:</b> <code>${amount}</code>` : null,
    ]
        .filter(Boolean)
        .join('\n');
};

const providerLink = (event: CrmEvent): string =>
    `<a href="${event.data.loginUrl}">Open Provider Panel</a>`;

const getDaysPastDue = (event: CrmEvent): number =>
    Math.abs(dayjs().diff(dayjs(event.data.nextBillingAt), 'day'));

export const CRM_EVENTS_TEMPLATES: Record<TCRMEvents, CrmEventsTemplate> = {
    [EVENTS.CRM.INFRA_BILLING_NODE_PAYMENT_IN_7_DAYS]: (event) => `
<b>Payment Reminder - 7 Days</b>

${paymentInfo(event)}

${providerLink(event)}`,

    [EVENTS.CRM.INFRA_BILLING_NODE_PAYMENT_IN_3_DAYS]: (event) => `
<b>Payment Alert - 3 Days</b>

${paymentInfo(event)}

<i>Payment is due in 3 days.</i>

${providerLink(event)}`,

    [EVENTS.CRM.INFRA_BILLING_NODE_PAYMENT_IN_48HRS]: (event) => `
<b>Payment Alert - 2 Days</b>

${paymentInfo(event)}

<i>Payment is due in 2 days.</i>

${providerLink(event)}`,

    [EVENTS.CRM.INFRA_BILLING_NODE_PAYMENT_IN_24HRS]: (event) => `
<b>Urgent: Payment Due Tomorrow</b>

${paymentInfo(event)}

<i>Payment is due tomorrow.</i>

${providerLink(event)}`,

    [EVENTS.CRM.INFRA_BILLING_NODE_PAYMENT_DUE_TODAY]: (event) => `
<b>Critical: Payment Due Today</b>

${paymentInfo(event)}

<i>Payment must be completed today.</i>

${providerLink(event)}`,

    [EVENTS.CRM.INFRA_BILLING_NODE_PAYMENT_OVERDUE_24HRS]: (event) => `
<b>Overdue: First Notice</b>

${paymentInfo(event)}
<b>Days Overdue:</b> <code>${getDaysPastDue(event)} day(s)</code>

${providerLink(event)}`,

    [EVENTS.CRM.INFRA_BILLING_NODE_PAYMENT_OVERDUE_48HRS]: (event) => `
<b>Overdue: Second Notice</b>

${paymentInfo(event)}
<b>Days Overdue:</b> <code>${getDaysPastDue(event)} day(s)</code>

${providerLink(event)}`,

    [EVENTS.CRM.INFRA_BILLING_NODE_PAYMENT_OVERDUE_7_DAYS]: (event) => `
<b>Final Notice: Service Termination Risk</b>

${paymentInfo(event)}
<b>Days Overdue:</b> <code>${getDaysPastDue(event)} day(s)</code>

${providerLink(event)}`,
};

