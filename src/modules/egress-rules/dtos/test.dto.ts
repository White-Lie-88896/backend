import { createZodDto } from 'nestjs-zod';

import { TestEgressRuleCommand } from '@libs/contracts/commands';

export class TestEgressRuleRequestDto extends createZodDto(TestEgressRuleCommand.RequestSchema) {}
export class TestEgressRuleResponseDto extends createZodDto(TestEgressRuleCommand.ResponseSchema) {}
