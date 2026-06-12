import { createZodDto } from 'nestjs-zod';

import { ExportEgressConfigCommand, ImportEgressConfigCommand } from '@libs/contracts/commands';

export class ExportEgressConfigRequestDto extends createZodDto(
    ExportEgressConfigCommand.RequestSchema,
) {}
export class ExportEgressConfigResponseDto extends createZodDto(
    ExportEgressConfigCommand.ResponseSchema,
) {}
export class ImportEgressConfigRequestDto extends createZodDto(
    ImportEgressConfigCommand.RequestSchema,
) {}
export class ImportEgressConfigResponseDto extends createZodDto(
    ImportEgressConfigCommand.ResponseSchema,
) {}
