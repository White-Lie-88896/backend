import { Prisma } from '@prisma/client';

import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ICrud } from '@common/types/crud-port';

import { EgressRuleEntity } from '../entities/egress-rule.entity';
import { EgressRuleConverter } from '../egress-rules.converter';

@Injectable()
export class EgressRulesRepository implements ICrud<EgressRuleEntity> {
    constructor(
        private readonly prisma: TransactionHost<TransactionalAdapterPrisma>,
        private readonly converter: EgressRuleConverter,
    ) {}

    public async create(entity: EgressRuleEntity): Promise<EgressRuleEntity> {
        const model = this.converter.fromEntityToPrismaModel(entity);
        const result = await this.prisma.tx.egressRules.create({
            data: model,
        });
        return this.converter.fromPrismaModelToEntity(result);
    }

    public async findByUUID(uuid: string): Promise<EgressRuleEntity | null> {
        const result = await this.prisma.tx.egressRules.findUnique({
            where: { uuid },
        });
        if (!result) return null;
        return this.converter.fromPrismaModelToEntity(result);
    }

    public async update({ uuid, ...data }: Partial<EgressRuleEntity>): Promise<EgressRuleEntity> {
        const result = await this.prisma.tx.egressRules.update({
            where: { uuid },
            data,
        });
        return this.converter.fromPrismaModelToEntity(result);
    }

    public async findByCriteria(criteria: Partial<EgressRuleEntity>): Promise<EgressRuleEntity[]> {
        const dto = { ...criteria };
        delete dto.targetUsers;

        const list = await this.prisma.tx.egressRules.findMany({
            where: dto as Prisma.EgressRulesWhereInput,
            orderBy: {
                viewPosition: 'asc',
            },
        });
        return this.converter.fromPrismaModelsToEntities(list);
    }

    public async findFirstByCriteria(
        criteria: Partial<EgressRuleEntity>,
    ): Promise<EgressRuleEntity | null> {
        const dto = { ...criteria };
        delete dto.targetUsers;

        const result = await this.prisma.tx.egressRules.findFirst({
            where: dto as Prisma.EgressRulesWhereInput,
        });
        if (!result) return null;
        return this.converter.fromPrismaModelToEntity(result);
    }

    public async deleteByUUID(uuid: string): Promise<boolean> {
        const result = await this.prisma.tx.egressRules.delete({
            where: { uuid },
        });
        return !!result;
    }

    public async reorder(uuids: string[]): Promise<boolean> {
        // Run updates sequentially or inside transaction
        for (let i = 0; i < uuids.length; i++) {
            await this.prisma.tx.egressRules.update({
                where: { uuid: uuids[i] },
                data: { viewPosition: i + 1 },
            });
        }
        return true;
    }

    public async incrementTraffic(
        ruleUuid: string,
        nodeUuid: string,
        uplinkBytes: bigint,
        downlinkBytes: bigint,
        hitCount: bigint = 1n,
        lastHitAt: Date = new Date(),
    ): Promise<void> {
        await this.prisma.tx.egressRuleTrafficStats.upsert({
            where: {
                ruleUuid_nodeUuid: { ruleUuid, nodeUuid },
            },
            create: { ruleUuid, nodeUuid, uplinkBytes, downlinkBytes, hitCount, lastHitAt },
            update: {
                uplinkBytes: { increment: uplinkBytes },
                downlinkBytes: { increment: downlinkBytes },
                hitCount: { increment: hitCount },
                lastHitAt,
            },
        });
    }

    public async getTrafficTotals(): Promise<
        Map<
            string,
            {
                uplinkBytes: bigint;
                downlinkBytes: bigint;
                hitCount: bigint;
                lastHitAt: Date | null;
            }
        >
    > {
        const totals = await this.prisma.tx.egressRuleTrafficStats.groupBy({
            by: ['ruleUuid'],
            _sum: {
                uplinkBytes: true,
                downlinkBytes: true,
                hitCount: true,
            },
            _max: {
                lastHitAt: true,
            },
        });

        return new Map(
            totals.map((item) => [
                item.ruleUuid,
                {
                    uplinkBytes: item._sum.uplinkBytes ?? 0n,
                    downlinkBytes: item._sum.downlinkBytes ?? 0n,
                    hitCount: item._sum.hitCount ?? 0n,
                    lastHitAt: item._max.lastHitAt ?? null,
                },
            ]),
        );
    }

    public async upsert(entity: EgressRuleEntity): Promise<EgressRuleEntity> {
        const model = this.converter.fromEntityToPrismaModel(entity);
        const result = await this.prisma.tx.egressRules.upsert({
            where: { uuid: entity.uuid },
            create: model,
            update: model,
        });
        return this.converter.fromPrismaModelToEntity(result);
    }
}
