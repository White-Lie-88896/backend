import { createZodDto } from 'nestjs-zod';

import { CreateEgressRuleCommand } from '@libs/contracts/commands';

export class CreateEgressRuleRequestDto extends createZodDto(
    CreateEgressRuleCommand.RequestSchema,
) {}
export class CreateEgressRuleResponseDto extends createZodDto(
    CreateEgressRuleCommand.ResponseSchema,
) {}
