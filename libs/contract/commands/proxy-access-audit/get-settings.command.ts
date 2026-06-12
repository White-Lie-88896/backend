import { z } from 'zod';

import { ProxyAccessAuditSettingsSchema } from '../../models';
import { PROXY_ACCESS_AUDIT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace GetProxyAccessAuditSettingsCommand {
    export const url = REST_API.PROXY_ACCESS_AUDIT.SETTINGS;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        PROXY_ACCESS_AUDIT_ROUTES.SETTINGS,
        'get',
        'Get proxy access audit settings',
        'Can only be used with admin JWT-token.',
    );

    export const ResponseSchema = z.object({
        response: ProxyAccessAuditSettingsSchema,
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
