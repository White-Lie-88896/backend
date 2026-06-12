import { createZodDto } from 'nestjs-zod';

import { ImportEgressRuleListCommand } from '@libs/contracts/commands';

export class ImportEgressRuleListRequestDto extends createZodDto(
    ImportEgressRuleListCommand.RequestSchema,
) {}
export class ImportEgressRuleListResponseDto extends createZodDto(
    ImportEgressRuleListCommand.ResponseSchema,
) {}
