import dayjs from 'dayjs';

export const NOTIFICATION_CONFIGS = {
    INFRA_BILLING_NODE_PAYMENT_IN_7_DAYS: {
        reminderDay: 7,
        from: () => dayjs().add(7, 'days').startOf('day').toDate(),
        to: () => dayjs().add(7, 'days').endOf('day').toDate(),
    },
    INFRA_BILLING_NODE_PAYMENT_IN_3_DAYS: {
        reminderDay: 3,
        from: () => dayjs().add(3, 'days').startOf('day').toDate(),
        to: () => dayjs().add(3, 'days').endOf('day').toDate(),
    },
    INFRA_BILLING_NODE_PAYMENT_IN_48HRS: {
        reminderDay: 2,
        from: () => dayjs().add(2, 'days').startOf('day').toDate(),
        to: () => dayjs().add(2, 'days').endOf('day').toDate(),
    },
    INFRA_BILLING_NODE_PAYMENT_IN_24HRS: {
        reminderDay: 1,
        from: () => dayjs().add(1, 'day').startOf('day').toDate(),
        to: () => dayjs().add(1, 'day').endOf('day').toDate(),
    },
    INFRA_BILLING_NODE_PAYMENT_DUE_TODAY: {
        reminderDay: 0,
        from: () => dayjs().startOf('day').toDate(),
        to: () => dayjs().endOf('day').toDate(),
    },
    INFRA_BILLING_NODE_PAYMENT_OVERDUE_24HRS: {
        reminderDay: -1,
        from: () => dayjs().subtract(1, 'day').startOf('day').toDate(),
        to: () => dayjs().subtract(1, 'day').endOf('day').toDate(),
    },
    INFRA_BILLING_NODE_PAYMENT_OVERDUE_48HRS: {
        reminderDay: -2,
        from: () => dayjs().subtract(2, 'days').startOf('day').toDate(),
        to: () => dayjs().subtract(2, 'days').endOf('day').toDate(),
    },
    INFRA_BILLING_NODE_PAYMENT_OVERDUE_7_DAYS: {
        reminderDay: -7,
        from: () => dayjs().subtract(7, 'days').startOf('day').toDate(),
        to: () => dayjs().subtract(7, 'days').endOf('day').toDate(),
    },
} as const;

export type TBillingNodeNotificationType = keyof typeof NOTIFICATION_CONFIGS;
