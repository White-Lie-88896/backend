export const EGRESS_RULES_CONTROLLER = 'egress-rules' as const;

export const EGRESS_RULES_ROUTES = {
    CREATE: '',
    GET: '',
    GET_BY_UUID: (uuid: string) => `${uuid}`,
    UPDATE: '',
    DELETE: (uuid: string) => `${uuid}`,
    ACTIONS: {
        IMPORT_RULE_LIST: 'actions/import-rule-list',
        REORDER: 'actions/reorder',
    },
    TEST: 'actions/test',
    OUTBOUNDS: {
        CREATE: 'outbounds',
        GET: 'outbounds',
        UPDATE: 'outbounds',
        TEST: 'outbounds/actions/test',
        DELETE: (uuid: string) => `outbounds/${uuid}`,
    },
    GROUPS: {
        CREATE: 'groups',
        GET: 'groups',
        UPDATE: 'groups',
        DELETE: (uuid: string) => `groups/${uuid}`,
    },
    SUBSCRIPTIONS: {
        CREATE: 'subscriptions',
        GET: 'subscriptions',
        UPDATE: (uuid: string) => `subscriptions/${uuid}`,
        SYNC: (uuid: string) => `subscriptions/${uuid}/actions/sync`,
        DELETE: (uuid: string) => `subscriptions/${uuid}`,
    },
    CONFIG: {
        EXPORT: 'config/actions/export',
        IMPORT: 'config/actions/import',
    },
} as const;
