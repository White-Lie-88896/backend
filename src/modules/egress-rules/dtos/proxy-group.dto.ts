import { createZodDto } from 'nestjs-zod';

import {
    CreateProxyGroupCommand,
    DeleteProxyGroupCommand,
    GetProxyGroupsCommand,
    UpdateProxyGroupCommand,
} from '@libs/contracts/commands';

export class CreateProxyGroupRequestDto extends createZodDto(
    CreateProxyGroupCommand.RequestSchema,
) {}
export class CreateProxyGroupResponseDto extends createZodDto(
    CreateProxyGroupCommand.ResponseSchema,
) {}
export class UpdateProxyGroupRequestDto extends createZodDto(
    UpdateProxyGroupCommand.RequestSchema,
) {}
export class UpdateProxyGroupResponseDto extends createZodDto(
    UpdateProxyGroupCommand.ResponseSchema,
) {}
export class GetProxyGroupsResponseDto extends createZodDto(GetProxyGroupsCommand.ResponseSchema) {}
export class DeleteProxyGroupRequestDto extends createZodDto(
    DeleteProxyGroupCommand.RequestSchema,
) {}
export class DeleteProxyGroupResponseDto extends createZodDto(
    DeleteProxyGroupCommand.ResponseSchema,
) {}
