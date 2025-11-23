import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { isCuid } from '@paralleldrive/cuid2';

/**
 * NestJS Pipe zur Validierung von CUID-Parametern in Controller-Routen.
 *
 * Verwendet die offizielle isCuid()-Funktion aus @paralleldrive/cuid2 für robuste Validierung.
 * Akzeptiert sowohl CUID1 (25 Zeichen, beginnt mit 'c') als auch CUID2 Formate.
 *
 * @example
 * ```typescript
 * @Get(':id')
 * findOne(@Param('id', ParseCuidPipe) id: string) {
 *   // id ist garantiert ein gültiges CUID
 *   return this.service.findOne(id);
 * }
 * ```
 */
@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('Validation failed (CUID string expected)');
    }

    if (!isCuid(value)) {
      throw new BadRequestException('Validation failed (invalid CUID format)');
    }

    return value;
  }
}
