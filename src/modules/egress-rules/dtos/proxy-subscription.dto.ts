import { createZodDto } from 'nestjs-zod';

import {
    CreateProxySubscriptionCommand,
    DeleteProxySubscriptionCommand,
    GetProxySubscriptionsCommand,
    SyncProxySubscriptionCommand,
    UpdateProxySubscriptionCommand,
} from '@libs/contracts/commands';

export class CreateProxySubscriptionRequestDto extends createZodDto(
    CreateProxySubscriptionCommand.RequestSchema,
) {}
export class CreateProxySubscriptionResponseDto extends createZodDto(
    CreateProxySubscriptionCommand.ResponseSchema,
) {}
export class GetProxySubscriptionsResponseDto extends createZodDto(
    GetProxySubscriptionsCommand.ResponseSchema,
) {}
export class SyncProxySubscriptionRequestDto extends createZodDto(
    SyncProxySubscriptionCommand.RequestSchema,
) {}
export class SyncProxySubscriptionResponseDto extends createZodDto(
    SyncProxySubscriptionCommand.ResponseSchema,
) {}
export class UpdateProxySubscriptionRequestDto extends createZodDto(
    UpdateProxySubscriptionCommand.RequestSchema,
) {}
export class UpdateProxySubscriptionRouteDto extends createZodDto(
    UpdateProxySubscriptionCommand.RouteSchema,
) {}
export class UpdateProxySubscriptionResponseDto extends createZodDto(
    UpdateProxySubscriptionCommand.ResponseSchema,
) {}
export class DeleteProxySubscriptionRequestDto extends createZodDto(
    DeleteProxySubscriptionCommand.RequestSchema,
) {}
export class DeleteProxySubscriptionResponseDto extends createZodDto(
    DeleteProxySubscriptionCommand.ResponseSchema,
) {}
