import { z } from 'zod';

import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { EgressConfigBackupSchema } from '../../models';
import { getEndpointDetails } from '../../constants';

export namespace ImportEgressConfigCommand {
    export const url = REST_API.EGRESS_RULES.CONFIG.IMPORT;
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.CONFIG.IMPORT,
        'post',
        'Import egress configuration',
        'Merges records by UUID and preserves existing redacted secrets.',
    );
    export const RequestSchema = z.object({ backup: EgressConfigBackupSchema });
    export type Request = z.infer<typeof RequestSchema>;
    export const ResponseSchema = z.object({
        response: z.object({
            proxyOutbounds: z.number().int().nonnegative(),
            proxyGroups: z.number().int().nonnegative(),
            rules: z.number().int().nonnegative(),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}
