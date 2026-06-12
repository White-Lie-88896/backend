import { Job } from 'bullmq';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ClientProxy } from '@nestjs/microservices';
import { Inject, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { GetCombinedStatsCommand } from '@remnawave/node-contract';

import { MESSAGING_NAMES, MICROSERVICES_NAMES } from '@common/microservices';
import { AxiosService } from '@common/axios';
import { IngestProxyAccessLogsCommand } from '@libs/contracts/commands';

import { UpsertHistoryEntryCommand } from '@modules/nodes-usage-history/commands/upsert-history-entry';
import { IncrementUsedTrafficCommand } from '@modules/nodes/commands/increment-used-traffic';
import { NodesUsageHistoryEntity } from '@modules/nodes-usage-history';
import { EgressRulesService } from '@modules/egress-rules';
import { ProxyAccessAuditService } from '@modules/proxy-access-audit/proxy-access-audit.service';

import { INodeMetrics } from '@scheduler/tasks/export-metrics/node-metrics.message.interface';

import { QUEUES_NAMES } from '@queue/queue.enum';

import { NODES_JOB_NAMES } from '../constants/nodes-job-name.constant';
import { IRecordNodeUsagePayload } from '../interfaces';

const PROXY_ACCESS_AUDIT_INGEST_BATCH_SIZE = 1000;

@Processor(QUEUES_NAMES.NODES.RECORD_NODE_USAGE, {
    concurrency: 40,
})
export class RecordNodeUsageQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(RecordNodeUsageQueueProcessor.name);

    constructor(
        private readonly commandBus: CommandBus,
        private readonly axios: AxiosService,
        private readonly egressRulesService: EgressRulesService,
        private readonly proxyAccessAuditService: ProxyAccessAuditService,
        @Inject(MICROSERVICES_NAMES.REDIS_PRODUCER) private readonly redisProducer: ClientProxy,
    ) {
        super();
    }

    async process(job: Job<IRecordNodeUsagePayload>) {
        try {
            const { nodeUuid, nodeAddress, nodePort } = job.data;

            const combinedStats = await this.axios.getCombinedStats(
                {
                    reset: true,
                },
                nodeAddress,
                nodePort,
            );

            if (!combinedStats.isOk) {
                this.logger.warn(
                    `Node ${nodeUuid}, ${nodeAddress}:${nodePort} – stats are not available, skipping`,
                );
                return;
            }

            await this.collectProxyAccessAuditLogs(nodeUuid, nodeAddress, nodePort);

            return this.handleOk(nodeUuid, combinedStats.response);
        } catch (error) {
            this.logger.error(
                `Error handling "${NODES_JOB_NAMES.RECORD_NODE_USAGE}" job: ${error}`,
            );

            return { isOk: false };
        }
    }

    private async collectProxyAccessAuditLogs(
        nodeUuid: string,
        nodeAddress: string,
        nodePort: null | number,
    ): Promise<void> {
        const snapshot = await this.axios.getAccessAuditLogs(
            {
                reset: false,
            },
            nodeAddress,
            nodePort,
        );

        if (!snapshot.isOk) {
            this.logger.warn(`Node ${nodeUuid} access audit logs are not available, skipping`);
            return;
        }

        const { logs, cursor, dropped } = snapshot.response;
        if (dropped > 0) {
            this.logger.warn(`Node ${nodeUuid} dropped ${dropped} access audit logs`);
        }

        if (logs.length === 0 || cursor === 0) return;

        const ingestLogs: IngestProxyAccessLogsCommand.Request['logs'] = logs.map((log) => ({
            ...log,
            nodeUuid,
        }));

        for (let i = 0; i < ingestLogs.length; i += PROXY_ACCESS_AUDIT_INGEST_BATCH_SIZE) {
            const chunk = ingestLogs.slice(i, i + PROXY_ACCESS_AUDIT_INGEST_BATCH_SIZE);
            const result = await this.proxyAccessAuditService.ingestLogs({ logs: chunk });

            if (!result.isOk) {
                this.logger.warn(`Failed to ingest access audit logs for node ${nodeUuid}`);
                return;
            }
        }

        const ack = await this.axios.getAccessAuditLogs(
            {
                reset: true,
                cursor,
                includeLogs: false,
            },
            nodeAddress,
            nodePort,
        );

        if (!ack.isOk) {
            this.logger.warn(`Failed to acknowledge access audit logs for node ${nodeUuid}`);
        }
    }

    private async handleOk(
        nodeUuid: string,
        combinedStats: GetCombinedStatsCommand.Response['response'],
    ): Promise<void> {
        const nodeOutboundsMetrics = new Map<
            string,
            {
                downlink: string;
                uplink: string;
            }
        >();

        const nodeInboundsMetrics = new Map<
            string,
            {
                downlink: string;
                uplink: string;
            }
        >();

        const { totalDownlink, totalUplink } = combinedStats.outbounds.reduce(
            (acc, outbound) => ({
                totalDownlink: acc.totalDownlink + (outbound.downlink || 0),
                totalUplink: acc.totalUplink + (outbound.uplink || 0),
            }),
            { totalDownlink: 0, totalUplink: 0 },
        ) || { totalDownlink: 0, totalUplink: 0 };

        await this.egressRulesService.recordRuleTraffic(nodeUuid, combinedStats.outbounds);

        if (totalDownlink === 0 && totalUplink === 0) {
            return;
        }

        const totalBytes = totalDownlink + totalUplink;

        await this.commandBus.execute(
            new UpsertHistoryEntryCommand(
                new NodesUsageHistoryEntity({
                    nodeUuid,
                    totalBytes: BigInt(totalBytes),
                    uploadBytes: BigInt(totalUplink),
                    downloadBytes: BigInt(totalDownlink),
                    createdAt: new Date(),
                }),
            ),
        );

        await this.commandBus.execute(
            new IncrementUsedTrafficCommand(nodeUuid, BigInt(totalBytes)),
        );

        combinedStats.outbounds.forEach((outbound) => {
            nodeOutboundsMetrics.set(outbound.outbound, {
                downlink: outbound.downlink.toString(),
                uplink: outbound.uplink.toString(),
            });
        });

        combinedStats.inbounds.forEach((inbound) => {
            nodeInboundsMetrics.set(inbound.inbound, {
                downlink: inbound.downlink.toString(),
                uplink: inbound.uplink.toString(),
            });
        });

        await this.sendNodeMetrics({
            nodeUuid,
            nodeOutboundsMetrics,
            nodeInboundsMetrics,
        });

        return;
    }

    private async sendNodeMetrics(dto: {
        nodeUuid: string;
        nodeOutboundsMetrics: Map<string, { downlink: string; uplink: string }>;
        nodeInboundsMetrics: Map<string, { downlink: string; uplink: string }>;
    }): Promise<void> {
        this.redisProducer.emit(MESSAGING_NAMES.NODE_METRICS, {
            nodeUuid: dto.nodeUuid,
            inbounds: Array.from(dto.nodeInboundsMetrics.entries()).map(([tag, metrics]) => ({
                tag,
                downlink: metrics.downlink,
                uplink: metrics.uplink,
            })),
            outbounds: Array.from(dto.nodeOutboundsMetrics.entries()).map(([tag, metrics]) => ({
                tag,
                downlink: metrics.downlink,
                uplink: metrics.uplink,
            })),
        } satisfies INodeMetrics);
    }
}
