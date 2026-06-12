import { AuditLogs, Prisma } from '@prisma/client';

import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { GetAuditLogsCommand } from '@libs/contracts/commands';

import { CreateAuditLog } from '../interfaces';
import { AuditLogEntity } from '../entities';

@Injectable()
export class AuditLogsRepository {
    constructor(private readonly prisma: TransactionHost<TransactionalAdapterPrisma>) {}

    public async create(dto: CreateAuditLog): Promise<AuditLogEntity> {
        const data: Prisma.AuditLogsCreateInput = {
            actorType: dto.actorType,
            actorId: dto.actorId,
            actorName: dto.actorName,
            action: dto.action,
            resourceType: dto.resourceType,
            resourceId: dto.resourceId,
            ip: dto.ip,
            userAgent: dto.userAgent,
            result: dto.result,
            message: dto.message,
            ...(dto.metadata === undefined
                ? {}
                : { metadata: dto.metadata as Prisma.InputJsonValue }),
        };

        const result = await this.prisma.tx.auditLogs.create({ data });
        return new AuditLogEntity(result);
    }

    public async findById(id: string): Promise<AuditLogEntity | null> {
        const result = await this.prisma.tx.auditLogs.findUnique({ where: { id } });
        return result ? new AuditLogEntity(result) : null;
    }

    public async deleteById(id: string): Promise<boolean> {
        const result = await this.prisma.tx.auditLogs.delete({ where: { id } });
        return !!result;
    }

    public async findMany(
        query: GetAuditLogsCommand.RequestQuery,
    ): Promise<[AuditLogEntity[], number]> {
        const where: Prisma.AuditLogsWhereInput = {
            ...(query.startTime || query.endTime
                ? {
                      createdAt: {
                          ...(query.startTime ? { gte: new Date(query.startTime) } : {}),
                          ...(query.endTime ? { lte: new Date(query.endTime) } : {}),
                      },
                  }
                : {}),
            ...(query.actorType ? { actorType: query.actorType } : {}),
            ...(query.actorName
                ? { actorName: { contains: query.actorName, mode: 'insensitive' } }
                : {}),
            ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
            ...(query.resourceType ? { resourceType: query.resourceType } : {}),
            ...(query.result ? { result: query.result } : {}),
            ...(query.ip ? { ip: { contains: query.ip, mode: 'insensitive' } } : {}),
        };

        const [records, total] = await Promise.all([
            this.prisma.tx.auditLogs.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: query.start,
                take: query.size,
            }),
            this.prisma.tx.auditLogs.count({ where }),
        ]);

        return [records.map((record: AuditLogs) => new AuditLogEntity(record)), total];
    }
}
