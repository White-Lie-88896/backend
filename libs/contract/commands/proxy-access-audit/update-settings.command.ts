import { z } from 'zod';

import { ByteStringSchema, ProxyAccessAuditSettingsSchema } from '../../models';
import { PROXY_ACCESS_AUDIT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace UpdateProxyAccessAuditSettingsCommand {
    export const url = REST_API.PROXY_ACCESS_AUDIT.SETTINGS;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        PROXY_ACCESS_AUDIT_ROUTES.SETTINGS,
        'patch',
        'Update proxy access audit settings',
        'Can only be used with admin JWT-token.',
    );

    export const RequestSchema = z.object({
        isEnabled: z.boolean().optional(),
        retentionDays: z.coerce.number().int().min(1).max(365).optional(),
        hideUsernames: z.boolean().optional(),
        aggregateOnly: z.boolean().optional(),
        distinctDomainWindowMinutes: z.coerce.number().int().min(1).max(1440).optional(),
        distinctDomainThreshold: z.coerce.number().int().min(1).max(10000).optional(),
        highRiskPorts: z.array(z.coerce.number().int().min(1).max(65_535)).max(100).optional(),
        nodeSpikeMultiplier: z.coerce.number().int().min(1).max(100).optional(),
        nodeSpikeMinBytes: ByteStringSchema.optional(),
        blacklistedHosts: z.array(z.string().trim().min(1).max(255)).max(1000).optional(),
        blacklistedIps: z.array(z.string().trim().min(1).max(64)).max(1000).optional(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: ProxyAccessAuditSettingsSchema,
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
