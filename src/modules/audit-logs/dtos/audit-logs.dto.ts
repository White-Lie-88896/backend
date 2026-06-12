import { createZodDto } from 'nestjs-zod';

import {
    DeleteAuditLogCommand,
    GetAuditLogCommand,
    GetAuditLogsCommand,
} from '@libs/contracts/commands';

export class GetAuditLogsRequestQueryDto extends createZodDto(
    GetAuditLogsCommand.RequestQuerySchema,
) {}

export class GetAuditLogsResponseDto extends createZodDto(GetAuditLogsCommand.ResponseSchema) {}

export class GetAuditLogRequestDto extends createZodDto(GetAuditLogCommand.RequestSchema) {}

export class GetAuditLogResponseDto extends createZodDto(GetAuditLogCommand.ResponseSchema) {}

export class DeleteAuditLogRequestDto extends createZodDto(DeleteAuditLogCommand.RequestSchema) {}

export class DeleteAuditLogResponseDto extends createZodDto(DeleteAuditLogCommand.ResponseSchema) {}
