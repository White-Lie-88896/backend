type DiagnosticCheckStatus = 'OK' | 'WARN' | 'FAIL';

interface DiagnosticCheck {
    key: string;
    label: string;
    status: DiagnosticCheckStatus;
    message: string;
}

export interface IGetDiagnosticsResponse {
    generatedAt: string;
    version: {
        app: string;
        backendCommitSha: string;
        frontendCommitSha: string;
        branch: string;
        buildTime: string;
        buildNumber: string;
    };
    database: {
        ok: boolean;
        users: number;
        activeUsers: number;
        nodes: number;
        enabledNodes: number;
        connectedNodes: number;
        auditLogs: number;
        proxyAccessLogs: number;
        proxyAccessAlertsOpen: number;
        lastAuditLogAt: string | null;
        lastProxyAccessLogAt: string | null;
    };
    runtime: {
        instances: number;
        apiInstances: number;
        schedulerInstances: number;
        processorInstances: number;
        oldestMetricAt: number | null;
        newestMetricAt: number | null;
    };
    egress: {
        rules: number;
        enabledRules: number;
        proxyOutbounds: number;
        enabledProxyOutbounds: number;
        unhealthyProxyOutbounds: number;
        unknownProxyOutbounds: number;
        proxySubscriptions: number;
        failedProxySubscriptions: number;
        lastSubscriptionSyncAt: string | null;
        ruleHitCount: string;
        ruleTrafficBytes: string;
    };
    audit: {
        isEnabled: boolean;
        retentionDays: number;
        aggregateOnly: boolean;
        hideUsernames: boolean;
        openAlerts: number;
        warningAlerts: number;
        criticalAlerts: number;
    };
    billing: {
        trackedNodes: number;
        overdueNodes: number;
        dueSoonNodes: number;
    };
    checks: DiagnosticCheck[];
}

export class GetDiagnosticsResponseModel implements IGetDiagnosticsResponse {
    generatedAt: string;
    version: IGetDiagnosticsResponse['version'];
    database: IGetDiagnosticsResponse['database'];
    runtime: IGetDiagnosticsResponse['runtime'];
    egress: IGetDiagnosticsResponse['egress'];
    audit: IGetDiagnosticsResponse['audit'];
    billing: IGetDiagnosticsResponse['billing'];
    checks: DiagnosticCheck[];

    constructor(data: IGetDiagnosticsResponse) {
        this.generatedAt = data.generatedAt;
        this.version = data.version;
        this.database = data.database;
        this.runtime = data.runtime;
        this.egress = data.egress;
        this.audit = data.audit;
        this.billing = data.billing;
        this.checks = data.checks;
    }
}
