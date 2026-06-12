import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';

import { AuditLogsRepository } from './repositories/audit-logs.repository';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

@Module({
    imports: [CqrsModule],
    controllers: [AuditLogsController],
    providers: [AuditLogsRepository, AuditLogsService],
    exports: [AuditLogsService],
})
export class AuditLogsModule {}
