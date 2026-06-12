import { createZodDto } from 'nestjs-zod';

import { ReorderEgressRulesCommand } from '@libs/contracts/commands';

export class ReorderEgressRulesRequestDto extends createZodDto(
    ReorderEgressRulesCommand.RequestSchema,
) {}
export class ReorderEgressRulesResponseDto extends createZodDto(
    ReorderEgressRulesCommand.ResponseSchema,
) {}
