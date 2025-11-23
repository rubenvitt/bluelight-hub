import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import type { ValidatedUser } from '@/auth/strategies/jwt.strategy';
import { ApiWrappedResponse } from '@/common/decorators/api-wrapped-response.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConsumes, ApiForbiddenResponse, ApiNotFoundResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { join } from 'node:path';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import type { LagekarteService } from '../services/lagekarte.service';
import type { SaveLagekarteStateDto } from '../dto/save-lagekarte-state.dto';
import type { Lagekarte } from '@prisma/client';

/**
 * Controller für Lagekarten-Management
 *
 * **Lazy Creation Pattern:**
 * - Lagekarten werden erst beim ersten GET-Request erstellt, nicht bei Einsatz-Erstellung
 * - Bei Erstellung wird automatisch ein initialer POI (Typ: EINSATZORT) aus `einsatz.einsatzort` geocoded
 *
 * **Route Structure:**
 * - Base: `/einsatz/:einsatzId/lagekarte`
 * - Alle Routes sind JWT-geschützt via `JwtAuthGuard`
 *
 * @security Alle Endpunkte erfordern valides JWT Token
 */
@ApiTags('Lagekarte')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig' })
@ApiForbiddenResponse({ description: 'Keine Berechtigung für diese Aktion' })
@Controller({
  path: 'einsatz/:einsatzId/lagekarte',
  version: 'alpha',
})
export class LagekarteController {
  private readonly logger = new Logger(LagekarteController.name);
  private readonly uploadsPath: string;
  private readonly uploadDir: string;

  constructor(
    private readonly lagekarteService: LagekarteService,
    private readonly configService: ConfigService,
  ) {
    // Get uploads path from ENV or use default (relative to project root)
    const uploadsBase = this.configService.get<string>('UPLOADS_PATH') || 'uploads';
    this.uploadsPath = join(process.cwd(), uploadsBase);
    this.uploadDir = join(this.uploadsPath, 'lagekarte');

    // Ensure uploads directory exists
    try {
      mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Uploads directory ready: ${this.uploadDir}`);
    } catch (error) {
      this.logger.error(`Failed to create uploads directory: ${this.uploadDir}`, error);
    }
  }

  /**
   * Lagekarte abrufen oder lazy erstellen
   *
   * **Lazy Creation:**
   * - Wenn keine Lagekarte existiert, wird sie automatisch erstellt
   * - Bei Neuerstellung wird initialer POI (Typ: EINSATZORT) aus `einsatz.einsatzort` geocoded
   *
   * @param einsatzId - ID des Einsatzes
   * @returns Lagekarte mit allen POIs
   */
  @Get()
  @ApiOperation({
    summary: 'Lagekarte abrufen',
    description:
      'Gibt die Lagekarte für einen Einsatz zurück. Lazy Creation: Wenn keine Lagekarte existiert, wird sie automatisch erstellt mit initialem POI (Typ: EINSATZORT) aus einsatz.einsatzort.',
  })
  @ApiWrappedResponse(Object, { description: 'Lagekarte erfolgreich abgerufen oder erstellt' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  async getLagekarte(@Param('einsatzId') einsatzId: string): Promise<Lagekarte> {
    this.logger.log(`Getting Lagekarte for Einsatz ${einsatzId}`);
    const lagekarte = await this.lagekarteService.getOrCreateLagekarte(einsatzId);
    this.logger.log(`Lagekarte ${lagekarte.id} returned for Einsatz ${einsatzId}`);
    return lagekarte;
  }

  /**
   * Lagekarte-State speichern (GeoJSON Zeichnungen)
   *
   * @param einsatzId - ID des Einsatzes
   * @param dto - SaveLagekarteStateDto mit state (GeoJSON FeatureCollection)
   * @param user - Authentifizierter User
   * @returns Aktualisierte Lagekarte
   */
  @Post()
  @ApiOperation({
    summary: 'Lagekarte-State speichern',
    description: 'Speichert den GeoJSON State (Zeichnungen) einer Lagekarte. Der State enthält Polygone, Linien und Marker im GeoJSON FeatureCollection Format.',
  })
  @ApiWrappedResponse(Object, { description: 'Lagekarte-State erfolgreich gespeichert' })
  @ApiNotFoundResponse({ description: 'Lagekarte nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async saveLagekarteState(
    @Param('einsatzId') einsatzId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: SaveLagekarteStateDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<Lagekarte> {
    this.logger.log(`Saving Lagekarte state for Einsatz ${einsatzId} by user ${user.userId}`);

    // Get existing Lagekarte
    const lagekarte = await this.lagekarteService.findByEinsatzId(einsatzId);
    if (!lagekarte) {
      this.logger.error(`Lagekarte not found for Einsatz ${einsatzId}`);
      throw new NotFoundException(`Lagekarte for Einsatz ${einsatzId} not found`);
    }

    // Update state
    const updated = await this.lagekarteService.updateState(lagekarte.id, dto.state);
    this.logger.log(`Lagekarte ${lagekarte.id} state updated for Einsatz ${einsatzId}`);
    return updated;
  }

  /**
   * Screenshot der Lagekarte hochladen (für ETB-Integration)
   *
   * **Security:**
   * - PNG und JPEG-Files erlaubt (MIME-Type Validierung)
   * - Filename Sanitization (verhindert Path Traversal)
   * - Max. File-Size: 10MB
   *
   * **Storage:**
   * - Ziel: `/uploads/lagekarte/{einsatzId}_{timestamp}.{png|jpg}`
   * - Persistierung via Docker Volume
   *
   * @param einsatzId - ID des Einsatzes
   * @param file - Hochgeladenes Screenshot-File (PNG oder JPEG)
   * @param user - Authentifizierter User
   * @returns File URL für ETB-Integration
   */
  @Post('screenshot')
  @ApiOperation({
    summary: 'Screenshot der Lagekarte hochladen',
    description: 'Upload eines Screenshots der Lagekarte für ETB-Integration. PNG- und JPEG-Files bis 10MB. Rückgabe: File-URL für Verwendung in ETB-Einträgen.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Screenshot-Datei (PNG oder JPEG, max 10MB)',
        },
      },
    },
  })
  @ApiWrappedResponse(Object, { description: 'Screenshot erfolgreich hochgeladen' })
  @ApiBadRequestResponse({ description: 'Ungültiges File-Format oder zu groß' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          // Use project root for uploads (consistent with ServeStaticModule)
          const uploadsBase = process.env.UPLOADS_PATH || 'uploads';
          const uploadsPath = join(process.cwd(), uploadsBase);
          const uploadDir = join(uploadsPath, 'lagekarte');

          // Ensure directory exists
          try {
            mkdirSync(uploadDir, { recursive: true });
          } catch {
            // Ignore errors - directory likely exists
          }

          cb(null, uploadDir);
        },
        filename: (req, uploadedFile, cb) => {
          const reqEinsatzId = req.params.einsatzId || 'unknown';
          const timestamp = Date.now();
          // Sanitize: Prevent path traversal
          const sanitizedEinsatzId = reqEinsatzId.replace(/[^a-zA-Z0-9_-]/g, '');
          // Use correct extension based on MIME type
          const extension = uploadedFile.mimetype === 'image/jpeg' ? 'jpg' : 'png';
          cb(null, `${sanitizedEinsatzId}_${timestamp}.${extension}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max (Lagekarten-Screenshots mit scale:2 können groß sein)
      },
      fileFilter: (_req, uploadedFile, cb) => {
        // Validate MIME type: Accept PNG and JPEG
        const allowedMimeTypes = ['image/png', 'image/jpeg'];
        if (!allowedMimeTypes.includes(uploadedFile.mimetype)) {
          return cb(new BadRequestException('Only PNG and JPEG files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadScreenshot(@Param('einsatzId') einsatzId: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: ValidatedUser): Promise<{ url: string }> {
    this.logger.log(`Uploading screenshot for Einsatz ${einsatzId} by user ${user.userId}`);

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileUrl = `/uploads/lagekarte/${file.filename}`;
    this.logger.log(`Screenshot uploaded: ${fileUrl}`);

    return { url: fileUrl };
  }

  /**
   * Screenshot löschen (für ETB-Fehler-Cleanup)
   *
   * **Security:**
   * - Filename Validierung (verhindert Path Traversal)
   * - Nur Screenshots des angegebenen Einsatzes können gelöscht werden
   * - File-Existence-Check vor Löschung
   *
   * **Use Case:**
   * - Cleanup wenn ETB-Eintrag-Erstellung fehlschlägt (AC7)
   *
   * @param einsatzId - ID des Einsatzes
   * @param filename - Dateiname des Screenshots (z.B. "einsatzId_timestamp.png" oder "einsatzId_timestamp.jpg")
   * @param user - Authentifizierter User
   */
  @Delete('screenshot/:filename')
  @ApiOperation({
    summary: 'Screenshot löschen',
    description: 'Löscht einen Screenshot der Lagekarte (PNG oder JPEG). Verwendet für Cleanup wenn ETB-Eintrag-Erstellung fehlschlägt (AC7). Filename-Validierung verhindert Path Traversal.',
  })
  @ApiWrappedResponse(Object, { description: 'Screenshot erfolgreich gelöscht' })
  @ApiBadRequestResponse({ description: 'Ungültiger Filename oder Path Traversal-Versuch' })
  @ApiNotFoundResponse({ description: 'Screenshot nicht gefunden' })
  @ApiForbiddenResponse({ description: 'Keine Berechtigung - Screenshot gehört zu anderem Einsatz' })
  async deleteScreenshot(@Param('einsatzId') einsatzId: string, @Param('filename') filename: string, @CurrentUser() user: ValidatedUser): Promise<{ message: string }> {
    this.logger.log(`Deleting screenshot ${filename} for Einsatz ${einsatzId} by user ${user.userId}`);

    // Validate filename (prevent path traversal)
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      this.logger.error(`Invalid filename: ${filename}`);
      throw new BadRequestException('Invalid filename - Path traversal not allowed');
    }

    // Validate filename format: Must be "einsatzId_timestamp.png" or "einsatzId_timestamp.jpg"
    const filenamePattern = /^[a-zA-Z0-9_-]+_\d+\.(png|jpg)$/;
    if (!filenamePattern.test(filename)) {
      this.logger.error(`Invalid filename format: ${filename}`);
      throw new BadRequestException('Invalid filename format - Expected: einsatzId_timestamp.png or einsatzId_timestamp.jpg');
    }

    // Verify filename starts with einsatzId (authorization check)
    const sanitizedEinsatzId = einsatzId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!filename.startsWith(`${sanitizedEinsatzId}_`)) {
      this.logger.error(`Authorization failed: Screenshot ${filename} does not belong to Einsatz ${einsatzId}`);
      throw new ForbiddenException('Screenshot does not belong to this Einsatz');
    }

    // Build full file path
    const filePath = join(this.uploadDir, filename);

    // Check file existence
    if (!existsSync(filePath)) {
      this.logger.error(`Screenshot not found: ${filePath}`);
      throw new NotFoundException(`Screenshot ${filename} not found`);
    }

    // Delete file
    try {
      unlinkSync(filePath);
      this.logger.log(`Screenshot deleted: ${filePath}`);
      return { message: 'Screenshot deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete screenshot: ${filePath}`, error);
      throw new BadRequestException('Failed to delete screenshot');
    }
  }

  /**
   * Lagekarte löschen (CASCADE: POIs werden automatisch mitgelöscht)
   *
   * @param einsatzId - ID des Einsatzes
   * @param user - Authentifizierter User
   */
  @Delete()
  @ApiOperation({
    summary: 'Lagekarte löschen',
    description: 'Löscht die Lagekarte eines Einsatzes. CASCADE: Alle zugehörigen POIs werden automatisch mitgelöscht.',
  })
  @ApiWrappedResponse(Object, { description: 'Lagekarte erfolgreich gelöscht' })
  @ApiNotFoundResponse({ description: 'Lagekarte nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  async deleteLagekarte(@Param('einsatzId') einsatzId: string, @CurrentUser() user: ValidatedUser): Promise<void> {
    this.logger.warn(`Deleting Lagekarte for Einsatz ${einsatzId} by user ${user.userId}`);

    // Get existing Lagekarte
    const lagekarte = await this.lagekarteService.findByEinsatzId(einsatzId);
    if (!lagekarte) {
      this.logger.error(`Lagekarte not found for Einsatz ${einsatzId}`);
      throw new NotFoundException(`Lagekarte for Einsatz ${einsatzId} not found`);
    }

    // Delete (cascade to POIs)
    await this.lagekarteService.deleteLagekarte(lagekarte.id);
    this.logger.warn(`Lagekarte ${lagekarte.id} deleted for Einsatz ${einsatzId} (CASCADE to POIs)`);
  }
}
