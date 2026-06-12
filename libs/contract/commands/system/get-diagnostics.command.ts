import { z } from 'zod';

import { getEndpointDetails } from '../../constants';
import { REST_API, SYSTEM_ROUTES } from '../../api';

export namespace GetDiagnosticsCommand {
    export const url = REST_API.SYSTEM.DIAGNOSTICS;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        SYSTEM_ROUTES.DIAGNOSTICS,
        'get',
        'Get System Diagnostics',
    );

    const CheckStatusSchema = z.enum(['OK', 'WARN', 'FAIL']);

    export const ResponseSchema = z.object({
        response: z.object({
            generatedAt: z.string(),
            version: z.object({
                app: z.string(),
                backendCommitSha: z.string(),
                frontendCommitSha: z.string(),
                branch: z.string(),
                buildTime: z.string(),
                buildNumber: z.string(),
            }),
            database: z.object({
                ok: z.boolean(),
                users: z.number(),
                activeUsers: z.number(),
                nodes: z.number(),
                enabledNodes: z.number(),
                connectedNodes: z.number(),
                auditLogs: z.number(),
                proxyAccessLogs: z.number(),
                proxyAccessAlertsOpen: z.number(),
                lastAuditLogAt: z.string().nullable(),
                lastProxyAccessLogAt: z.string().nullable(),
            }),
            runtime: z.object({
                instances: z.number(),
                apiInstances: z.number(),
                schedulerInstances: z.number(),
                processorInstances: z.number(),
                oldestMetricAt: z.number().nullable(),
                newestMetricAt: z.number().nullable(),
            }),
            egress: z.object({
                rules: z.number(),
                enabledRules: z.number(),
                proxyOutbounds: z.number(),
                enabledProxyOutbounds: z.number(),
                unhealthyProxyOutbounds: z.number(),
                unknownProxyOutbounds: z.number(),
                proxySubscriptions: z.number(),
                failedProxySubscriptions: z.number(),
                lastSubscriptionSyncAt: z.string().nullable(),
                ruleHitCount: z.string(),
                ruleTrafficBytes: z.string(),
            }),
            audit: z.object({
                isEnabled: z.boolean(),
                retentionDays: z.number(),
                aggregateOnly: z.boolean(),
                hideUsernames: z.boolean(),
                openAlerts: z.number(),
                warningAlerts: z.number(),
                criticalAlerts: z.number(),
            }),
            billing: z.object({
                trackedNodes: z.number(),
                overdueNodes: z.number(),
                dueSoonNodes: z.number(),
            }),
            checks: z.array(
                z.object({
                    key: z.string(),
                    label: z.string(),
                    status: CheckStatusSchema,
                    message: z.string(),
                }),
            ),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
