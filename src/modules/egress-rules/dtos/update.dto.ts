import { createZodDto } from 'nestjs-zod';

import { UpdateEgressRuleCommand } from '@libs/contracts/commands';

export class UpdateEgressRuleRequestDto extends createZodDto(
    UpdateEgressRuleCommand.RequestSchema,
) {}
export class UpdateEgressRuleResponseDto extends createZodDto(
    UpdateEgressRuleCommand.ResponseSchema,
) {}
