import { z } from 'zod';

import { AUDIT_LOGS_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace DeleteAuditLogCommand {
    export const url = REST_API.AUDIT_LOGS.DELETE;
    export const TSQ_url = url(':id');

    export const endpointDetails = getEndpointDetails(
        AUDIT_LOGS_ROUTES.DELETE(':id'),
        'delete',
        'Delete audit log by ID',
    );

    export const RequestSchema = z.object({
        id: z.string().uuid(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            result: z.boolean(),
        }),
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
