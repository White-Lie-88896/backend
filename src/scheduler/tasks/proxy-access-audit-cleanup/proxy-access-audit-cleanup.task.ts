import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { ProxyAccessAuditService } from '@modules/proxy-access-audit';

import { JOBS_INTERVALS } from '../../intervals';

@Injectable()
export class ProxyAccessAuditCleanupTask {
    private static readonly CRON_NAME = 'proxyAccessAuditCleanup';
    private readonly logger = new Logger(ProxyAccessAuditCleanupTask.name);

    constructor(private readonly proxyAccessAuditService: ProxyAccessAuditService) {}

    @Cron(JOBS_INTERVALS.PROXY_ACCESS_AUDIT.CLEANUP, {
        name: ProxyAccessAuditCleanupTask.CRON_NAME,
        waitForCompletion: true,
    })
    async handleCron() {
        try {
            const result = await this.proxyAccessAuditService.cleanup({ clearAlerts: true });

            if (!result.isOk) {
                this.logger.error(result);
                return;
            }

            const { deletedAlerts, deletedLogs } = result.response;
            if (deletedLogs > 0 || deletedAlerts > 0) {
                this.logger.log(
                    `Cleaned proxy access audit retention: ${deletedLogs} logs, ${deletedAlerts} alerts`,
                );
            }
        } catch (error) {
            this.logger.error(error);
        }
    }
}
