import { createZodDto } from 'nestjs-zod';

import { DeleteEgressRuleCommand } from '@libs/contracts/commands';

export class DeleteEgressRuleRequestDto extends createZodDto(
    DeleteEgressRuleCommand.RequestSchema,
) {}
export class DeleteEgressRuleResponseDto extends createZodDto(
    DeleteEgressRuleCommand.ResponseSchema,
) {}
