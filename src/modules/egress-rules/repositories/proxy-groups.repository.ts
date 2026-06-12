import { Prisma } from '@prisma/client';

import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ProxyGroupMode } from '@libs/contracts/models';

import { ProxyGroupEntity } from '../entities/proxy-group.entity';

@Injectable()
export class ProxyGroupsRepository {
    constructor(private readonly prisma: TransactionHost<TransactionalAdapterPrisma>) {}

    private toEntity(result: {
        outboundUuids: unknown;
        mode: string;
        [key: string]: unknown;
    }): ProxyGroupEntity {
        return new ProxyGroupEntity({
            ...result,
            mode: result.mode as ProxyGroupMode,
            outboundUuids: Array.isArray(result.outboundUuids)
                ? result.outboundUuids.filter((uuid): uuid is string => typeof uuid === 'string')
                : [],
        });
    }

    public async create(data: {
        name: string;
        description?: string | null;
        mode: ProxyGroupMode;
        outboundUuids: string[];
        isEnabled?: boolean;
    }): Promise<ProxyGroupEntity> {
        const result = await this.prisma.tx.proxyGroups.create({
            data: {
                ...data,
                outboundUuids: data.outboundUuids as Prisma.InputJsonValue,
            },
        });
        return this.toEntity(result);
    }

    public async findAll(): Promise<ProxyGroupEntity[]> {
        const groups = await this.prisma.tx.proxyGroups.findMany({ orderBy: { name: 'asc' } });
        return groups.map((group) => this.toEntity(group));
    }

    public async findEnabled(): Promise<ProxyGroupEntity[]> {
        const groups = await this.prisma.tx.proxyGroups.findMany({
            where: { isEnabled: true },
            orderBy: { name: 'asc' },
        });
        return groups.map((group) => this.toEntity(group));
    }

    public async findByUUID(uuid: string): Promise<ProxyGroupEntity | null> {
        const result = await this.prisma.tx.proxyGroups.findUnique({ where: { uuid } });
        return result ? this.toEntity(result) : null;
    }

    public async findByName(name: string): Promise<ProxyGroupEntity | null> {
        const result = await this.prisma.tx.proxyGroups.findUnique({ where: { name } });
        return result ? this.toEntity(result) : null;
    }

    public async update(
        uuid: string,
        data: {
            name?: string;
            description?: string | null;
            mode?: ProxyGroupMode;
            outboundUuids?: string[];
            isEnabled?: boolean;
        },
    ): Promise<ProxyGroupEntity> {
        const result = await this.prisma.tx.proxyGroups.update({
            where: { uuid },
            data: {
                ...data,
                outboundUuids: data.outboundUuids as Prisma.InputJsonValue | undefined,
            },
        });
        return this.toEntity(result);
    }

    public async deleteByUUID(uuid: string): Promise<boolean> {
        return !!(await this.prisma.tx.proxyGroups.delete({ where: { uuid } }));
    }

    public async upsert(data: {
        uuid: string;
        name: string;
        description: string | null;
        mode: ProxyGroupMode;
        outboundUuids: string[];
        isEnabled: boolean;
    }): Promise<ProxyGroupEntity> {
        const { uuid, ...values } = data;
        const outboundUuids = values.outboundUuids as Prisma.InputJsonValue;
        const result = await this.prisma.tx.proxyGroups.upsert({
            where: { uuid },
            create: { uuid, ...values, outboundUuids },
            update: { ...values, outboundUuids },
        });
        return this.toEntity(result);
    }
}
