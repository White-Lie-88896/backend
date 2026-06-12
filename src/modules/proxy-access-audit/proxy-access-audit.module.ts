import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';

import { PrismaModule } from '@common/database';

import { ProxyAccessAuditRepository } from './repositories/proxy-access-audit.repository';
import { ProxyAccessAuditController } from './proxy-access-audit.controller';
import { ProxyAccessAuditService } from './proxy-access-audit.service';

@Module({
    imports: [PrismaModule, CqrsModule],
    controllers: [ProxyAccessAuditController],
    providers: [ProxyAccessAuditRepository, ProxyAccessAuditService],
    exports: [ProxyAccessAuditService],
})
export class ProxyAccessAuditModule {}
