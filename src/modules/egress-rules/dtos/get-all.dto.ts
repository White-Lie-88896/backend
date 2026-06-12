import { createZodDto } from 'nestjs-zod';

import { FindAllEgressRulesCommand } from '@libs/contracts/commands';

export class FindAllEgressRulesResponseDto extends createZodDto(
    FindAllEgressRulesCommand.ResponseSchema,
) {}
