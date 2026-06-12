import { Request } from 'express';

import { Controller, HttpStatus, Param, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { UserAgent } from '@common/decorators/get-useragent/get-useragent';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { IpAddress } from '@common/decorators/get-ip/get-ip';
import { Endpoint } from '@common/decorators/base-endpoint';
import { Roles } from '@common/decorators/roles/roles';
import { RolesGuard } from '@common/guards/roles';
import {
    DeleteAuditLogCommand,
    GetAuditLogCommand,
    GetAuditLogsCommand,
} from '@libs/contracts/commands';
import { AUDIT_LOGS_CONTROLLER, CONTROLLERS_INFO } from '@libs/contracts/api';
import { ROLE } from '@libs/contracts/constants';

import { IJWTAuthPayload } from '@modules/auth/interfaces';

import {
    DeleteAuditLogRequestDto,
    DeleteAuditLogResponseDto,
    GetAuditLogRequestDto,
    GetAuditLogResponseDto,
    GetAuditLogsRequestQueryDto,
    GetAuditLogsResponseDto,
} from './dtos';
import { AuditLogsService } from './audit-logs.service';

@ApiBearerAuth('Authorization')
@ApiTags(CONTROLLERS_INFO.AUDIT_LOGS.tag)
@Roles(ROLE.ADMIN)
@UseGuards(JwtDefaultGuard, RolesGuard)
@UseFilters(HttpExceptionFilter)
@Controller(AUDIT_LOGS_CONTROLLER)
export class AuditLogsController {
    constructor(private readonly auditLogsService: AuditLogsService) {}

    @ApiOkResponse({ type: GetAuditLogsResponseDto })
    @Endpoint({ command: GetAuditLogsCommand, httpCode: HttpStatus.OK })
    async getAuditLogs(
        @Query() query: GetAuditLogsRequestQueryDto,
    ): Promise<GetAuditLogsResponseDto> {
        return { response: errorHandler(await this.auditLogsService.getAuditLogs(query)) };
    }

    @ApiOkResponse({ type: GetAuditLogResponseDto })
    @Endpoint({ command: GetAuditLogCommand, httpCode: HttpStatus.OK })
    async getAuditLog(@Param() params: GetAuditLogRequestDto): Promise<GetAuditLogResponseDto> {
        return { response: errorHandler(await this.auditLogsService.getAuditLog(params.id)) };
    }

    @ApiOkResponse({ type: DeleteAuditLogResponseDto })
    @Endpoint({ command: DeleteAuditLogCommand, httpCode: HttpStatus.OK })
    async deleteAuditLog(
        @Param() params: DeleteAuditLogRequestDto,
        @Req() request: Request,
        @IpAddress() ip: string,
        @UserAgent() userAgent: string,
    ): Promise<DeleteAuditLogResponseDto> {
        const result = await this.auditLogsService.deleteAuditLog(params.id);
        const actor = request.user as IJWTAuthPayload | undefined;

        await this.auditLogsService.createLog({
            actorType: 'admin',
            actorId: actor?.uuid,
            actorName: actor?.username,
            action: 'audit_log.delete',
            resourceType: 'audit_log',
            resourceId: params.id,
            ip,
            userAgent,
            result: result.isOk ? 'success' : 'failed',
            message: result.isOk ? 'Audit log deleted successfully.' : 'Audit log deletion failed.',
        });

        return { response: errorHandler(result) };
    }
}
