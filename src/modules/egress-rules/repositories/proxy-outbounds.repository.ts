import { Prisma } from '@prisma/client';

import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ProxyOutboundConfig } from '@libs/contracts/models';

import { ProxyOutboundEntity } from '../entities/proxy-outbound.entity';

@Injectable()
export class ProxyOutboundsRepository {
    constructor(private readonly prisma: TransactionHost<TransactionalAdapterPrisma>) {}

    private toEntity(result: {
        config: unknown;
        healthStatus: string;
        [key: string]: unknown;
    }): ProxyOutboundEntity {
        return new ProxyOutboundEntity({
            ...result,
            config: result.config as ProxyOutboundConfig,
            healthStatus: result.healthStatus as ProxyOutboundEntity['healthStatus'],
        });
    }

    public async create(data: {
        name: string;
        description?: string | null;
        config: ProxyOutboundConfig;
        isEnabled?: boolean;
    }): Promise<ProxyOutboundEntity> {
        const result = await this.prisma.tx.proxyOutbounds.create({
            data: {
                ...data,
                config: data.config as Prisma.InputJsonValue,
            },
        });
        return this.toEntity(result);
    }

    public async findAll(): Promise<ProxyOutboundEntity[]> {
        const list = await this.prisma.tx.proxyOutbounds.findMany({
            orderBy: { name: 'asc' },
        });
        return list.map((item) => this.toEntity(item));
    }

    public async findEnabled(): Promise<ProxyOutboundEntity[]> {
        const list = await this.prisma.tx.proxyOutbounds.findMany({
            where: { isEnabled: true },
            orderBy: { name: 'asc' },
        });
        return list.map((item) => this.toEntity(item));
    }

    public async findByUUID(uuid: string): Promise<ProxyOutboundEntity | null> {
        const result = await this.prisma.tx.proxyOutbounds.findUnique({ where: { uuid } });
        if (!result) return null;
        return this.toEntity(result);
    }

    public async findByName(name: string): Promise<ProxyOutboundEntity | null> {
        const result = await this.prisma.tx.proxyOutbounds.findUnique({ where: { name } });
        return result ? this.toEntity(result) : null;
    }

    public async update(
        uuid: string,
        data: {
            name?: string;
            description?: string | null;
            config?: ProxyOutboundConfig;
            isEnabled?: boolean;
            distributionMode?: string;
            targetUserIds?: number[];
            targetSquadUuids?: string[];
        },
    ): Promise<ProxyOutboundEntity> {
        const result = await this.prisma.tx.proxyOutbounds.update({
            where: { uuid },
            data: {
                ...data,
                config: data.config as Prisma.InputJsonValue | undefined,
            },
        });
        return this.toEntity(result);
    }

    public async deleteByUUID(uuid: string): Promise<boolean> {
        const result = await this.prisma.tx.proxyOutbounds.delete({ where: { uuid } });
        return !!result;
    }

    public async upsert(data: {
        uuid: string;
        name: string;
        description: string | null;
        config: ProxyOutboundConfig;
        isEnabled: boolean;
    }): Promise<ProxyOutboundEntity> {
        const { uuid, ...values } = data;
        const config = values.config as Prisma.InputJsonValue;
        const result = await this.prisma.tx.proxyOutbounds.upsert({
            where: { uuid },
            create: { uuid, ...values, config },
            update: { ...values, config },
        });
        return this.toEntity(result);
    }

    public async updateHealth(
        uuid: string,
        data: {
            healthStatus: 'HEALTHY' | 'UNHEALTHY';
            lastLatencyMs: number | null;
            lastHealthMessage: string;
            lastHealthCheckAt: Date;
        },
    ): Promise<void> {
        await this.prisma.tx.proxyOutbounds.update({ where: { uuid }, data });
    }
}
