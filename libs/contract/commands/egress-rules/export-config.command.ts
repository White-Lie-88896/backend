import { z } from 'zod';

import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { EgressConfigBackupSchema } from '../../models';
import { getEndpointDetails } from '../../constants';

export namespace ExportEgressConfigCommand {
    export const url = REST_API.EGRESS_RULES.CONFIG.EXPORT;
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.CONFIG.EXPORT,
        'post',
        'Export egress configuration',
        'Can only be used with admin JWT-token.',
    );
    export const RequestSchema = z.object({ includeSecrets: z.boolean().default(false) });
    export type Request = z.infer<typeof RequestSchema>;
    export const ResponseSchema = z.object({ response: EgressConfigBackupSchema });
    export type Response = z.infer<typeof ResponseSchema>;
}
