import { Body, Controller, HttpStatus, Query, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { Endpoint } from '@common/decorators/base-endpoint';
import { Roles } from '@common/decorators/roles/roles';
import { RolesGuard } from '@common/guards/roles';
import {
    CleanupProxyAccessAuditCommand,
    GetProxyAccessAlertsCommand,
    GetProxyAccessAuditSettingsCommand,
    GetProxyAccessLogsCommand,
    GetProxyAccessRuleHitsCommand,
    GetProxyAccessSummaryCommand,
    GetProxyAccessTopDomainsCommand,
    IngestProxyAccessLogsCommand,
    UpdateProxyAccessAuditSettingsCommand,
} from '@libs/contracts/commands';
import { CONTROLLERS_INFO, PROXY_ACCESS_AUDIT_CONTROLLER } from '@libs/contracts/api';
import { ROLE } from '@libs/contracts/constants';

import {
    CleanupProxyAccessAuditRequestDto,
    CleanupProxyAccessAuditResponseDto,
    GetProxyAccessAlertsRequestQueryDto,
    GetProxyAccessAlertsResponseDto,
    GetProxyAccessAuditSettingsResponseDto,
    GetProxyAccessLogsRequestQueryDto,
    GetProxyAccessLogsResponseDto,
    GetProxyAccessRuleHitsRequestQueryDto,
    GetProxyAccessRuleHitsResponseDto,
    GetProxyAccessSummaryRequestQueryDto,
    GetProxyAccessSummaryResponseDto,
    GetProxyAccessTopDomainsRequestQueryDto,
    GetProxyAccessTopDomainsResponseDto,
    IngestProxyAccessLogsRequestDto,
    IngestProxyAccessLogsResponseDto,
    UpdateProxyAccessAuditSettingsRequestDto,
    UpdateProxyAccessAuditSettingsResponseDto,
} from './dtos';
import { ProxyAccessAuditService } from './proxy-access-audit.service';

@ApiBearerAuth('Authorization')
@ApiTags(CONTROLLERS_INFO.PROXY_ACCESS_AUDIT.tag)
@UseGuards(JwtDefaultGuard, RolesGuard)
@UseFilters(HttpExceptionFilter)
@Controller(PROXY_ACCESS_AUDIT_CONTROLLER)
export class ProxyAccessAuditController {
    constructor(private readonly proxyAccessAuditService: ProxyAccessAuditService) {}

    @Roles(ROLE.API, ROLE.ADMIN)
    @Endpoint({
        command: IngestProxyAccessLogsCommand,
        httpCode: HttpStatus.CREATED,
        apiBody: IngestProxyAccessLogsRequestDto,
    })
    async ingestLogs(
        @Body() body: IngestProxyAccessLogsRequestDto,
    ): Promise<IngestProxyAccessLogsResponseDto> {
        return {
            response: errorHandler(await this.proxyAccessAuditService.ingestLogs(body)),
        };
    }

    @Roles(ROLE.ADMIN)
    @Endpoint({ command: GetProxyAccessLogsCommand, httpCode: HttpStatus.OK })
    async getLogs(
        @Query() query: GetProxyAccessLogsRequestQueryDto,
    ): Promise<GetProxyAccessLogsResponseDto> {
        return {
            response: errorHandler(await this.proxyAccessAuditService.getLogs(query)),
        };
    }

    @Roles(ROLE.ADMIN)
    @Endpoint({ command: GetProxyAccessSummaryCommand, httpCode: HttpStatus.OK })
    async getSummary(
        @Query() query: GetProxyAccessSummaryRequestQueryDto,
    ): Promise<GetProxyAccessSummaryResponseDto> {
        return {
            response: errorHandler(await this.proxyAccessAuditService.getSummary(query)),
        };
    }

    @Roles(ROLE.ADMIN)
    @Endpoint({ command: GetProxyAccessTopDomainsCommand, httpCode: HttpStatus.OK })
    async getTopDomains(
        @Query() query: GetProxyAccessTopDomainsRequestQueryDto,
    ): Promise<GetProxyAccessTopDomainsResponseDto> {
        return {
            response: errorHandler(await this.proxyAccessAuditService.getTopDomains(query)),
        };
    }

    @Roles(ROLE.ADMIN)
    @Endpoint({ command: GetProxyAccessRuleHitsCommand, httpCode: HttpStatus.OK })
    async getRuleHits(
        @Query() query: GetProxyAccessRuleHitsRequestQueryDto,
    ): Promise<GetProxyAccessRuleHitsResponseDto> {
        return {
            response: errorHandler(await this.proxyAccessAuditService.getRuleHits(query)),
        };
    }

    @Roles(ROLE.ADMIN)
    @Endpoint({ command: GetProxyAccessAlertsCommand, httpCode: HttpStatus.OK })
    async getAlerts(
        @Query() query: GetProxyAccessAlertsRequestQueryDto,
    ): Promise<GetProxyAccessAlertsResponseDto> {
        return {
            response: errorHandler(await this.proxyAccessAuditService.getAlerts(query)),
        };
    }

    @Roles(ROLE.ADMIN)
    @Endpoint({ command: GetProxyAccessAuditSettingsCommand, httpCode: HttpStatus.OK })
    async getSettings(): Promise<GetProxyAccessAuditSettingsResponseDto> {
        return {
            response: errorHandler(await this.proxyAccessAuditService.getSettings()),
        };
    }

    @Roles(ROLE.ADMIN)
    @Endpoint({
        command: UpdateProxyAccessAuditSettingsCommand,
        httpCode: HttpStatus.OK,
        apiBody: UpdateProxyAccessAuditSettingsRequestDto,
    })
    async updateSettings(
        @Body() body: UpdateProxyAccessAuditSettingsRequestDto,
    ): Promise<UpdateProxyAccessAuditSettingsResponseDto> {
        return {
            response: errorHandler(await this.proxyAccessAuditService.updateSettings(body)),
        };
    }

    @Roles(ROLE.ADMIN)
    @Endpoint({
        command: CleanupProxyAccessAuditCommand,
        httpCode: HttpStatus.OK,
        apiBody: CleanupProxyAccessAuditRequestDto,
    })
    async cleanup(
        @Body() body: CleanupProxyAccessAuditRequestDto,
    ): Promise<CleanupProxyAccessAuditResponseDto> {
        return {
            response: errorHandler(await this.proxyAccessAuditService.cleanup(body)),
        };
    }
}
