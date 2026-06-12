import { Prisma } from '@prisma/client';

import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ProxyOutboundConfig } from '@libs/contracts/models';

@Injectable()
export class ProxySubscriptionsRepository {
    constructor(private readonly prisma: TransactionHost<TransactionalAdapterPrisma>) {}

    public async findAll() {
        return this.prisma.tx.proxySubscriptions.findMany({
            include: { _count: { select: { outbounds: true } } },
            orderBy: { name: 'asc' },
        });
    }

    public async findByUUID(uuid: string) {
        return this.prisma.tx.proxySubscriptions.findUnique({
            where: { uuid },
            include: { _count: { select: { outbounds: true } } },
        });
    }

    public async create(data: {
        name: string;
        url: string;
        isEnabled?: boolean;
        updateIntervalMin?: number;
        distributionMode?: string;
        targetUserIds?: number[];
        targetSquadUuids?: string[];
    }) {
        return this.prisma.tx.proxySubscriptions.create({
            data,
            include: { _count: { select: { outbounds: true } } },
        });
    }

    public async update(
        uuid: string,
        data: {
            name?: string;
            url?: string;
            isEnabled?: boolean;
            updateIntervalMin?: number;
            distributionMode?: string;
            targetUserIds?: number[];
            targetSquadUuids?: string[];
        },
    ) {
        return this.prisma.tx.proxySubscriptions.update({
            where: { uuid },
            data,
            include: { _count: { select: { outbounds: true } } },
        });
    }

    public async findDistributedForUser(userId: bigint) {
        const memberships = await this.prisma.tx.internalSquadMembers.findMany({
            where: { userId },
            select: { internalSquadUuid: true },
        });
        const squadUuids = new Set(memberships.map((item) => item.internalSquadUuid));
        const subscriptions = await this.prisma.tx.proxySubscriptions.findMany({
            where: { isEnabled: true },
            include: {
                outbounds: {
                    where: { isEnabled: true },
                    orderBy: { name: 'asc' },
                },
            },
        });

        return subscriptions
            .map((subscription) => {
                const userIds = Array.isArray(subscription.targetUserIds)
                    ? subscription.targetUserIds
                    : [];
                const targets = Array.isArray(subscription.targetSquadUuids)
                    ? subscription.targetSquadUuids
                    : [];
                const subscriptionAllowed =
                    subscription.distributionMode === 'ALL' ||
                    (subscription.distributionMode === 'SELECTED' &&
                        (userIds.some((id) => String(id) === String(userId)) ||
                            targets.some(
                                (uuid) => typeof uuid === 'string' && squadUuids.has(uuid),
                            )));
                const outbounds = subscription.outbounds.filter((outbound) => {
                    if (outbound.distributionMode === 'INHERIT') return subscriptionAllowed;
                    if (outbound.distributionMode === 'NONE') return false;
                    if (outbound.distributionMode === 'ALL') return true;
                    const outboundUsers = Array.isArray(outbound.targetUserIds)
                        ? outbound.targetUserIds
                        : [];
                    const outboundSquads = Array.isArray(outbound.targetSquadUuids)
                        ? outbound.targetSquadUuids
                        : [];
                    return (
                        outboundUsers.some((id) => String(id) === String(userId)) ||
                        outboundSquads.some(
                            (uuid) => typeof uuid === 'string' && squadUuids.has(uuid),
                        )
                    );
                });
                return { ...subscription, outbounds };
            })
            .filter((subscription) => subscription.outbounds.length > 0);
    }

    public async updateSync(
        uuid: string,
        data: { lastSyncStatus: string; lastSyncMessage: string; lastSyncAt: Date },
    ) {
        return this.prisma.tx.proxySubscriptions.update({
            where: { uuid },
            data,
            include: { _count: { select: { outbounds: true } } },
        });
    }

    public async replaceNodes(
        subscriptionUuid: string,
        nodes: Array<{ sourceKey: string; name: string; config: ProxyOutboundConfig }>,
    ): Promise<void> {
        const sourceKeys = nodes.map((node) => node.sourceKey);
        await this.prisma.tx.proxyOutbounds.deleteMany({
            where: {
                subscriptionUuid,
                sourceKey: { notIn: sourceKeys },
            },
        });
        for (const node of nodes) {
            await this.prisma.tx.proxyOutbounds.upsert({
                where: {
                    subscriptionUuid_sourceKey: {
                        subscriptionUuid,
                        sourceKey: node.sourceKey,
                    },
                },
                create: {
                    subscriptionUuid,
                    sourceKey: node.sourceKey,
                    name: `${node.name} [${subscriptionUuid.slice(0, 8)}]`,
                    config: node.config as Prisma.InputJsonValue,
                },
                update: {
                    config: node.config as Prisma.InputJsonValue,
                    isEnabled: true,
                },
            });
        }
    }

    public async deleteByUUID(uuid: string): Promise<boolean> {
        return !!(await this.prisma.tx.proxySubscriptions.delete({ where: { uuid } }));
    }
}
