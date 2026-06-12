import { createZodDto } from 'nestjs-zod';

import { GetDiagnosticsCommand } from '@contract/commands';

export class GetDiagnosticsResponseDto extends createZodDto(GetDiagnosticsCommand.ResponseSchema) {}
