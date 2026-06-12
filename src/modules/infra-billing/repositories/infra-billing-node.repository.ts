import { Prisma } from '@prisma/client';
import { sql } from 'kysely';

import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { TxKyselyService } from '@common/database';
import { ICrud } from '@common/types/crud-port';

import {
    InfraAvailableBillingNodeEntity,
    InfraBillingNodeEntity,
    InfraBillingNodeNotificationEntity,
    TInfraBillingCurrency,
    TInfraBillingCycle,
} from '../entities';
import { NOTIFICATION_CONFIGS, TBillingNodeNotificationType } from '../interfaces';
import { InfraBillingNodeConverter } from '../converters';

@Injectable()
export class InfraBillingNodeRepository implements ICrud<InfraBillingNodeEntity> {
    constructor(
        private readonly prisma: TransactionHost<TransactionalAdapterPrisma>,
        private readonly qb: TxKyselyService,
        private readonly infraBillingNodeConverter: InfraBillingNodeConverter,
    ) {}

    private buildWhereFromCriteria(
        dto: Partial<InfraBillingNodeEntity>,
    ): Prisma.InfraBillingNodesWhereInput {
        // Entity relation snapshots are not valid Prisma filters.
        const { node, provider, reminderDays, ...rest } = dto;
        const where: Prisma.InfraBillingNodesWhereInput = rest;

        if (reminderDays !== undefined) {
            where.reminderDays = { equals: reminderDays };
        }

        return where;
    }

    public async create(entity: InfraBillingNodeEntity): Promise<InfraBillingNodeEntity> {
        const model = this.infraBillingNodeConverter.fromEntityToPrismaModel(entity);
        const result = await this.prisma.tx.infraBillingNodes.create({
            data: model,
        });

        return this.infraBillingNodeConverter.fromPrismaModelToEntity(result);
    }

    public async findByUUID(uuid: string): Promise<InfraBillingNodeEntity | null> {
        const result = await this.prisma.tx.infraBillingNodes.findUnique({
            where: { uuid },
        });
        if (!result) {
            return null;
        }
        return this.infraBillingNodeConverter.fromPrismaModelToEntity(result);
    }

    public async update({
        uuid,
        ...data
    }: Partial<InfraBillingNodeEntity>): Promise<InfraBillingNodeEntity> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { provider, node, ...rest } = data;
        const result = await this.prisma.tx.infraBillingNodes.update({
            where: {
                uuid,
            },
            data: rest,
        });

        return this.infraBillingNodeConverter.fromPrismaModelToEntity(result);
    }

    public async updateMany({
        uuids,
        billingAmount,
        billingCycle,
        billingCurrency,
        reminderDays,
        nextBillingAt,
    }: {
        uuids: string[];
        billingAmount?: number;
        billingCycle?: TInfraBillingCycle;
        billingCurrency?: TInfraBillingCurrency;
        reminderDays?: number[];
        nextBillingAt?: Date;
    }): Promise<boolean> {
        const data: Partial<
            Pick<
                InfraBillingNodeEntity,
                | 'billingAmount'
                | 'billingCycle'
                | 'billingCurrency'
                | 'reminderDays'
                | 'nextBillingAt'
            >
        > = {};

        if (nextBillingAt !== undefined) {
            data.nextBillingAt = nextBillingAt;
        }

        if (billingAmount !== undefined) {
            data.billingAmount = billingAmount;
        }

        if (billingCycle !== undefined) {
            data.billingCycle = billingCycle;
        }

        if (billingCurrency !== undefined) {
            data.billingCurrency = billingCurrency;
        }

        if (reminderDays !== undefined) {
            data.reminderDays = reminderDays;
        }

        if (Object.keys(data).length === 0) {
            return true;
        }

        const result = await this.prisma.tx.infraBillingNodes.updateMany({
            where: {
                uuid: { in: uuids },
            },
            data,
        });

        return !!result;
    }

    public async findByCriteria(
        dto: Partial<InfraBillingNodeEntity>,
    ): Promise<InfraBillingNodeEntity[]> {
        const infraBillingNodeList = await this.prisma.tx.infraBillingNodes.findMany({
            where: this.buildWhereFromCriteria(dto),
        });
        return this.infraBillingNodeConverter.fromPrismaModelsToEntities(infraBillingNodeList);
    }

    public async findFirstByCriteria(
        dto: Partial<InfraBillingNodeEntity>,
    ): Promise<InfraBillingNodeEntity | null> {
        const result = await this.prisma.tx.infraBillingNodes.findFirst({
            where: this.buildWhereFromCriteria(dto),
        });

        if (!result) {
            return null;
        }

        return this.infraBillingNodeConverter.fromPrismaModelToEntity(result);
    }

    public async deleteByUUID(uuid: string): Promise<boolean> {
        const result = await this.prisma.tx.infraBillingNodes.delete({ where: { uuid } });
        return !!result;
    }

    public async getBillingNodes(): Promise<InfraBillingNodeEntity[]> {
        const result = await this.prisma.tx.infraBillingNodes.findMany({
            include: {
                provider: {
                    select: {
                        uuid: true,
                        name: true,
                        faviconLink: true,
                        loginUrl: true,
                    },
                },
                node: {
                    select: {
                        uuid: true,
                        name: true,
                        countryCode: true,
                    },
                },
            },
            orderBy: {
                nextBillingAt: 'asc',
            },
        });

        return this.infraBillingNodeConverter.fromPrismaModelsToEntities(result);
    }

    public async getAvailableBillingNodes(): Promise<InfraAvailableBillingNodeEntity[]> {
        const result = await this.qb.kysely
            .selectFrom('nodes as n')
            .leftJoin('infraBillingNodes as ibn', 'ibn.nodeUuid', 'n.uuid')
            .select(['n.uuid', 'n.name', 'n.countryCode'])
            .where('ibn.nodeUuid', 'is', null)
            .orderBy('n.viewPosition', 'asc')
            .execute();

        return result.map((node) => new InfraAvailableBillingNodeEntity(node));
    }

    public async getInfraSummary(): Promise<{
        upcomingNodesCount: number;
        dueSoonNodesCount: number;
        overdueNodesCount: number;
        monthlyRenewalCost: number;
        yearlyRenewalCost: number;
        currentMonthPayments: number;
        totalSpent: number;
        renewalCostsByCurrency: {
            currency: TInfraBillingCurrency;
            monthlyRenewalCost: number;
            yearlyRenewalCost: number;
        }[];
    }> {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueSoonUntil = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const [
            upcomingNodes,
            dueSoonNodes,
            overdueNodes,
            renewalCosts,
            currentMonthPayments,
            totalSpent,
            renewalCostsByCurrency,
        ] = await Promise.all([
            this.qb.kysely
                .selectFrom('infraBillingNodes')
                .select((eb) => eb.fn.count('uuid').as('count'))
                .where('nextBillingAt', '>=', today)
                .where('nextBillingAt', '<', startOfNextMonth)
                .executeTakeFirst(),

            this.qb.kysely
                .selectFrom('infraBillingNodes')
                .select((eb) => eb.fn.count('uuid').as('count'))
                .where('billingAmount', '>', 0)
                .where('nextBillingAt', '>=', today)
                .where('nextBillingAt', '<=', dueSoonUntil)
                .executeTakeFirst(),

            this.qb.kysely
                .selectFrom('infraBillingNodes')
                .select((eb) => eb.fn.count('uuid').as('count'))
                .where('billingAmount', '>', 0)
                .where('nextBillingAt', '<', today)
                .executeTakeFirst(),

            this.qb.kysely
                .selectFrom('infraBillingNodes')
                .select(() => [
                    sql<number>`coalesce(round(sum(case when billing_cycle = 'YEARLY' then billing_amount / 12 else billing_amount end)::numeric, 2), 0)`.as(
                        'monthlyRenewalCost',
                    ),
                    sql<number>`coalesce(round(sum(case when billing_cycle = 'YEARLY' then billing_amount else billing_amount * 12 end)::numeric, 2), 0)`.as(
                        'yearlyRenewalCost',
                    ),
                ])
                .executeTakeFirst(),

            this.qb.kysely
                .selectFrom('infraBillingHistory')
                .select(() => sql<number>`coalesce(round(sum(amount)::numeric, 2), 0)`.as('amount'))
                .where('billedAt', '>=', startOfMonth)
                .where('billedAt', '<', startOfNextMonth)
                .executeTakeFirst(),

            this.qb.kysely
                .selectFrom('infraBillingHistory')
                .select(() => sql<number>`coalesce(round(sum(amount)::numeric, 2), 0)`.as('amount'))
                .executeTakeFirst(),

            this.qb.kysely
                .selectFrom('infraBillingNodes')
                .select((eb) => [
                    'billingCurrency as currency',
                    sql<number>`coalesce(round(sum(case when billing_cycle = 'YEARLY' then billing_amount / 12 else billing_amount end)::numeric, 2), 0)`.as(
                        'monthlyRenewalCost',
                    ),
                    sql<number>`coalesce(round(sum(case when billing_cycle = 'YEARLY' then billing_amount else billing_amount * 12 end)::numeric, 2), 0)`.as(
                        'yearlyRenewalCost',
                    ),
                    eb.fn.count('uuid').as('count'),
                ])
                .where('billingAmount', '>', 0)
                .groupBy('billingCurrency')
                .orderBy('billingCurrency', 'asc')
                .execute(),
        ]);

        const result = {
            upcomingNodesCount: Number(upcomingNodes?.count || 0),
            dueSoonNodesCount: Number(dueSoonNodes?.count || 0),
            overdueNodesCount: Number(overdueNodes?.count || 0),
            monthlyRenewalCost: Number(renewalCosts?.monthlyRenewalCost || 0),
            yearlyRenewalCost: Number(renewalCosts?.yearlyRenewalCost || 0),
            currentMonthPayments: Number(currentMonthPayments?.amount || 0),
            totalSpent: Number(totalSpent?.amount || 0),
            renewalCostsByCurrency: renewalCostsByCurrency.map((cost) => ({
                currency: cost.currency as TInfraBillingCurrency,
                monthlyRenewalCost: Number(cost.monthlyRenewalCost || 0),
                yearlyRenewalCost: Number(cost.yearlyRenewalCost || 0),
            })),
        };

        return result;
    }

    public async getNotificationsByType(
        notificationType: string,
    ): Promise<InfraBillingNodeNotificationEntity[]> {
        if (!NOTIFICATION_CONFIGS[notificationType as TBillingNodeNotificationType]) {
            throw new Error(`Invalid notification type: ${notificationType}`);
        }

        const config = NOTIFICATION_CONFIGS[notificationType as TBillingNodeNotificationType];
        const fromDate = config.from();
        const toDate = config.to();

        const result = await this.qb.kysely
            .selectFrom('infraBillingNodes as ibn')
            .innerJoin('nodes as n', 'n.uuid', 'ibn.nodeUuid')
            .innerJoin('infraProviders as ip', 'ip.uuid', 'ibn.providerUuid')
            .select([
                'n.name as nodeName',
                'ip.loginUrl',
                'ip.name as providerName',
                'ibn.nextBillingAt',
                'ibn.billingAmount',
                'ibn.billingCurrency',
            ])
            .where('ibn.nextBillingAt', '>=', fromDate)
            .where('ibn.nextBillingAt', '<', toDate)
            .where(sql<boolean>`${config.reminderDay} = any(ibn.reminder_days)`)
            .orderBy('ibn.nextBillingAt', 'asc')
            .execute();

        return result.map((node) => new InfraBillingNodeNotificationEntity(node));
    }

    public async getAllActiveNotifications(): Promise<InfraBillingNodeNotificationEntity[]> {
        const results = await Promise.all(
            Object.keys(NOTIFICATION_CONFIGS).map(async (type) => {
                const notifications = await this.getNotificationsByType(type);
                return notifications.map((notification) => ({
                    ...notification,
                    notificationType: type as TBillingNodeNotificationType,
                }));
            }),
        );

        return results.flat().map((node) => new InfraBillingNodeNotificationEntity(node));
    }
}
