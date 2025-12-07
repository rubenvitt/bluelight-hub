import { SetMetadata } from '@nestjs/common';

/**
 * Decorator zum Überspringen des TransformInterceptors
 *
 * Kann auf Controller- oder Methoden-Ebene angewendet werden,
 * um die automatische Response-Transformation zu deaktivieren.
 *
 * @example
 * // Auf Controller-Ebene
 * @SkipTransform()
 * @Controller('health')
 * export class HealthController {}
 *
 * @example
 * // Auf Methoden-Ebene
 * @Get('refresh')
 * @SkipTransform()
 * async refresh() {}
 */
export const SkipTransform = () => SetMetadata('skipTransform', true);
