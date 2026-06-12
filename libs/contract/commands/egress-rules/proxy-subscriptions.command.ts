import { z } from 'zod';

import { EGRESS_RULES_ROUTES, REST_API } from '../../api';
import { ProxySubscriptionSchema } from '../../models';
import { getEndpointDetails } from '../../constants';

const SubscriptionRequestSchema = z.object({
    name: z.string().trim().min(1).max(128),
    url: z.string().url(),
    isEnabled: z.boolean().optional(),
    updateIntervalMin: z.number().int().min(15).max(43_200).optional(),
    distributionMode: z.enum(['NONE', 'ALL', 'SELECTED']).optional(),
    targetUserIds: z.array(z.number().int().positive()).optional(),
    targetSquadUuids: z.array(z.string().uuid()).optional(),
});

const UpdateSubscriptionRequestSchema = SubscriptionRequestSchema.partial().extend({
    uuid: z.string().uuid(),
});

export namespace GetProxySubscriptionsCommand {
    export const url = REST_API.EGRESS_RULES.SUBSCRIPTIONS.GET;
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.SUBSCRIPTIONS.GET,
        'get',
        'Get proxy subscriptions',
        'Can only be used with admin JWT-token.',
    );
    export const ResponseSchema = z.object({ response: z.array(ProxySubscriptionSchema) });
}

export namespace CreateProxySubscriptionCommand {
    export const url = REST_API.EGRESS_RULES.SUBSCRIPTIONS.CREATE;
    export const TSQ_url = url;
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.SUBSCRIPTIONS.CREATE,
        'post',
        'Create and synchronize a proxy subscription',
        'Can only be used with admin JWT-token.',
    );
    export const RequestSchema = SubscriptionRequestSchema;
    export const ResponseSchema = z.object({ response: ProxySubscriptionSchema });
}

export namespace SyncProxySubscriptionCommand {
    export const url = REST_API.EGRESS_RULES.SUBSCRIPTIONS.SYNC;
    export const TSQ_url = url(':uuid');
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.SUBSCRIPTIONS.SYNC(':uuid'),
        'post',
        'Synchronize a proxy subscription',
        'Can only be used with admin JWT-token.',
    );
    export const RequestSchema = z.object({ uuid: z.string().uuid() });
    export const ResponseSchema = z.object({ response: ProxySubscriptionSchema });
}

export namespace UpdateProxySubscriptionCommand {
    export const url = REST_API.EGRESS_RULES.SUBSCRIPTIONS.UPDATE;
    export const TSQ_url = url(':uuid');
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.SUBSCRIPTIONS.UPDATE(':uuid'),
        'patch',
        'Update proxy subscription distribution',
        'Can only be used with admin JWT-token.',
    );
    export const RequestSchema = UpdateSubscriptionRequestSchema.omit({ uuid: true });
    export const RouteSchema = z.object({ uuid: z.string().uuid() });
    export const ResponseSchema = z.object({ response: ProxySubscriptionSchema });
}

export namespace DeleteProxySubscriptionCommand {
    export const url = REST_API.EGRESS_RULES.SUBSCRIPTIONS.DELETE;
    export const TSQ_url = url(':uuid');
    export const endpointDetails = getEndpointDetails(
        EGRESS_RULES_ROUTES.SUBSCRIPTIONS.DELETE(':uuid'),
        'delete',
        'Delete a proxy subscription and its nodes',
        'Can only be used with admin JWT-token.',
    );
    export const RequestSchema = z.object({ uuid: z.string().uuid() });
    export const ResponseSchema = z.object({ response: z.object({ isDeleted: z.boolean() }) });
}
