export const PROXY_ACCESS_AUDIT_CONTROLLER = 'proxy-access-audit' as const;

export const PROXY_ACCESS_AUDIT_ROUTES = {
    INGEST: 'ingest',
    LOGS: 'logs',
    SUMMARY: 'summary',
    TOP_DOMAINS: 'top-domains',
    RULE_HITS: 'rule-hits',
    ALERTS: 'alerts',
    SETTINGS: 'settings',
    CLEANUP: 'cleanup',
} as const;
