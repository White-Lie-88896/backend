import { Cron, CronExpression } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';

import { NodesQueuesService } from '@queue/_nodes';

import { EgressRulesService } from './egress-rules.service';

@Injectable()
export class ProxyOutboundsHealthTask {
    private readonly logger = new Logger(ProxyOutboundsHealthTask.name);

    constructor(
        private readonly egressRulesService: EgressRulesService,
        private readonly nodesQueuesService: NodesQueuesService,
    ) {}

    @Cron(CronExpression.EVERY_5_MINUTES, {
        name: 'proxyOutboundsHealthCheck',
        waitForCompletion: true,
    })
    public async handleCron(): Promise<void> {
        const outboundsResult = await this.egressRulesService.findProxyOutbounds();
        if (!outboundsResult.isOk) {
            this.logger.warn('Unable to load proxy outbounds for health check.');
            return;
        }

        const enabledOutbounds = outboundsResult.response.filter((outbound) => outbound.isEnabled);
        let healthChanged = false;

        for (let index = 0; index < enabledOutbounds.length; index += 10) {
            const batch = enabledOutbounds.slice(index, index + 10);
            await Promise.all(
                batch.map(async (outbound) => {
                    const result = await this.egressRulesService.testProxyOutbound(outbound.uuid);
                    if (
                        result.isOk &&
                        outbound.healthStatus !==
                            (result.response.success ? 'HEALTHY' : 'UNHEALTHY')
                    ) {
                        healthChanged = true;
                    }
                    if (!result.isOk || !result.response.success) {
                        this.logger.warn(`Proxy outbound "${outbound.name}" is unhealthy.`);
                    }
                }),
            );
        }

        if (healthChanged) {
            await this.nodesQueuesService.startAllNodes({
                emitter: 'proxy-outbound-health-change',
            });
        }
    }
}
