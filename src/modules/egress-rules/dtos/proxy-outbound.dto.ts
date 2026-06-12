import { createZodDto } from 'nestjs-zod';

import {
    CreateProxyOutboundCommand,
    DeleteProxyOutboundCommand,
    GetProxyOutboundsCommand,
    UpdateProxyOutboundCommand,
    TestProxyOutboundCommand,
} from '@libs/contracts/commands';

export class CreateProxyOutboundRequestDto extends createZodDto(
    CreateProxyOutboundCommand.RequestSchema,
) {}
export class CreateProxyOutboundResponseDto extends createZodDto(
    CreateProxyOutboundCommand.ResponseSchema,
) {}
export class UpdateProxyOutboundRequestDto extends createZodDto(
    UpdateProxyOutboundCommand.RequestSchema,
) {}
export class UpdateProxyOutboundResponseDto extends createZodDto(
    UpdateProxyOutboundCommand.ResponseSchema,
) {}
export class GetProxyOutboundsResponseDto extends createZodDto(
    GetProxyOutboundsCommand.ResponseSchema,
) {}
export class DeleteProxyOutboundRequestDto extends createZodDto(
    DeleteProxyOutboundCommand.RequestSchema,
) {}
export class DeleteProxyOutboundResponseDto extends createZodDto(
    DeleteProxyOutboundCommand.ResponseSchema,
) {}
export class TestProxyOutboundRequestDto extends createZodDto(
    TestProxyOutboundCommand.RequestSchema,
) {}
export class TestProxyOutboundResponseDto extends createZodDto(
    TestProxyOutboundCommand.ResponseSchema,
) {}
