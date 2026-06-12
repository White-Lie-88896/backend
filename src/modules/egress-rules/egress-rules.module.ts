import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';

import { PrismaModule } from '@common/database';

import { AuditLogsModule } from '@modules/audit-logs';

import { ProxyOutboundsRepository } from './repositories/proxy-outbounds.repository';
import { ProxyGroupsRepository } from './repositories/proxy-groups.repository';
import { EgressRulesRepository } from './repositories/egress-rules.repository';
import { ProxyOutboundsHealthTask } from './proxy-outbounds-health.task';
import { EgressRulesController } from './egress-rules.controller';
import { EgressRuleConverter } from './egress-rules.converter';
import { EgressRulesService } from './egress-rules.service';
import { ProxySubscriptionsRepository } from './repositories/proxy-subscriptions.repository';
import { ProxySubscriptionsSyncTask } from './proxy-subscriptions-sync.task';

@Module({
    imports: [PrismaModule, AuditLogsModule, CqrsModule],
    controllers: [EgressRulesController],
    providers: [
        EgressRulesRepository,
        ProxyOutboundsRepository,
        ProxyGroupsRepository,
        ProxySubscriptionsRepository,
        EgressRuleConverter,
        EgressRulesService,
        ProxyOutboundsHealthTask,
        ProxySubscriptionsSyncTask,
    ],
    exports: [EgressRulesService],
})
export class EgressRulesModule {}
