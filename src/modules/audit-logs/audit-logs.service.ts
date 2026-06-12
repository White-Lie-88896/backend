import { Injectable, Logger } from '@nestjs/common';

import { fail, ok, TResult } from '@common/types';
import { GetAuditLogsCommand } from '@libs/contracts/commands';
import { ERRORS } from '@libs/contracts/constants';

import { AuditLogsRepository } from './repositories/audit-logs.repository';
import { CreateAuditLog } from './interfaces';
import { AuditLogEntity } from './entities';

const SENSITIVE_KEYS = /authorization|cookie|password|private.?key|secret|token/i;

@Injectable()
export class AuditLogsService {
    private readonly logger = new Logger(AuditLogsService.name);

    constructor(private readonly repository: AuditLogsRepository) {}

    public async createLog(dto: CreateAuditLog): Promise<void> {
        try {
            await this.repository.create({
                ...dto,
                metadata: this.sanitizeMetadata(dto.metadata),
            });
        } catch (error) {
            this.logger.error('Audit log write failed', error);
        }
    }

    public async getAuditLogs(
        query: GetAuditLogsCommand.RequestQuery,
    ): Promise<TResult<{ records: AuditLogEntity[]; total: number }>> {
        try {
            const [records, total] = await this.repository.findMany(query);
            return ok({ records, total });
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.GET_AUDIT_LOGS_ERROR);
        }
    }

    public async getAuditLog(id: string): Promise<TResult<AuditLogEntity>> {
        try {
            const record = await this.repository.findById(id);
            return record ? ok(record) : fail(ERRORS.AUDIT_LOG_NOT_FOUND);
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.GET_AUDIT_LOGS_ERROR);
        }
    }

    public async deleteAuditLog(id: string): Promise<TResult<{ result: boolean }>> {
        try {
            const record = await this.repository.findById(id);
            if (!record) return fail(ERRORS.AUDIT_LOG_NOT_FOUND);

            return ok({ result: await this.repository.deleteById(id) });
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.DELETE_AUDIT_LOG_ERROR);
        }
    }

    private sanitizeMetadata(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((item) => this.sanitizeMetadata(item));
        }

        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [
                    key,
                    SENSITIVE_KEYS.test(key) ? '[REDACTED]' : this.sanitizeMetadata(item),
                ]),
            );
        }

        return value;
    }
}
