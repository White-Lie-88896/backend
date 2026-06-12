import { z } from 'zod';

import { AuditLogSchema } from '../../models';
import { AUDIT_LOGS_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace GetAuditLogCommand {
    export const url = REST_API.AUDIT_LOGS.GET_BY_ID;
    export const TSQ_url = url(':id');

    export const endpointDetails = getEndpointDetails(
        AUDIT_LOGS_ROUTES.GET_BY_ID(':id'),
        'get',
        'Get audit log by ID',
    );

    export const RequestSchema = z.object({
        id: z.string().uuid(),
    });

    export type Request = z.infer<typeof RequestSchema>;

    export const ResponseSchema = z.object({
        response: AuditLogSchema,
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
