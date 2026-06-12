import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { EgressRulesService } from './egress-rules.service';

@Injectable()
export class ProxySubscriptionsSyncTask {
    private readonly logger = new Logger(ProxySubscriptionsSyncTask.name);

    constructor(private readonly service: EgressRulesService) {}

    @Interval(300_000)
    async synchronizeDueSubscriptions(): Promise<void> {
        try {
            await this.service.syncDueProxySubscriptions();
        } catch (error) {
            this.logger.error(`Proxy subscription synchronization failed: ${error}`);
        }
    }
}
