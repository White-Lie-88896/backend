import { createZodDto } from 'nestjs-zod';

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

export class IngestProxyAccessLogsRequestDto extends createZodDto(
    IngestProxyAccessLogsCommand.RequestSchema,
) {}

export class IngestProxyAccessLogsResponseDto extends createZodDto(
    IngestProxyAccessLogsCommand.ResponseSchema,
) {}

export class GetProxyAccessLogsRequestQueryDto extends createZodDto(
    GetProxyAccessLogsCommand.RequestQuerySchema,
) {}

export class GetProxyAccessLogsResponseDto extends createZodDto(
    GetProxyAccessLogsCommand.ResponseSchema,
) {}

export class GetProxyAccessSummaryRequestQueryDto extends createZodDto(
    GetProxyAccessSummaryCommand.RequestQuerySchema,
) {}

export class GetProxyAccessSummaryResponseDto extends createZodDto(
    GetProxyAccessSummaryCommand.ResponseSchema,
) {}

export class GetProxyAccessTopDomainsRequestQueryDto extends createZodDto(
    GetProxyAccessTopDomainsCommand.RequestQuerySchema,
) {}

export class GetProxyAccessTopDomainsResponseDto extends createZodDto(
    GetProxyAccessTopDomainsCommand.ResponseSchema,
) {}

export class GetProxyAccessRuleHitsRequestQueryDto extends createZodDto(
    GetProxyAccessRuleHitsCommand.RequestQuerySchema,
) {}

export class GetProxyAccessRuleHitsResponseDto extends createZodDto(
    GetProxyAccessRuleHitsCommand.ResponseSchema,
) {}

export class GetProxyAccessAlertsRequestQueryDto extends createZodDto(
    GetProxyAccessAlertsCommand.RequestQuerySchema,
) {}

export class GetProxyAccessAlertsResponseDto extends createZodDto(
    GetProxyAccessAlertsCommand.ResponseSchema,
) {}

export class GetProxyAccessAuditSettingsResponseDto extends createZodDto(
    GetProxyAccessAuditSettingsCommand.ResponseSchema,
) {}

export class UpdateProxyAccessAuditSettingsRequestDto extends createZodDto(
    UpdateProxyAccessAuditSettingsCommand.RequestSchema,
) {}

export class UpdateProxyAccessAuditSettingsResponseDto extends createZodDto(
    UpdateProxyAccessAuditSettingsCommand.ResponseSchema,
) {}

export class CleanupProxyAccessAuditRequestDto extends createZodDto(
    CleanupProxyAccessAuditCommand.RequestSchema,
) {}

export class CleanupProxyAccessAuditResponseDto extends createZodDto(
    CleanupProxyAccessAuditCommand.ResponseSchema,
) {}
