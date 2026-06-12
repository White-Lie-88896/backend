export const AUDIT_LOGS_CONTROLLER = 'audit-logs' as const;

export const AUDIT_LOGS_ROUTES = {
    GET: '',
    GET_BY_ID: (id: string) => `${id}`,
    DELETE: (id: string) => `${id}`,
} as const;
