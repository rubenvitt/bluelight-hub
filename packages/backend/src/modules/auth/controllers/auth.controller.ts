import { toAdminLoginResponseDto, toAdminSetupResponseDto, toAdminStatusResponseDto, toAdminTokenVerificationDto, toLogoutResponseDto, toRefreshResponseDto, toUserResponseDto } from '../mappers';
import { SkipTransform } from '@/modules/common/decorators/skip-transform.decorator';
import { AppConfigService } from '@/infrastructure/services/app-config.service';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiCookieAuth, ApiForbiddenResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from '../auth.service';
import { clearAdminCookie, clearAuthCookies, setAdminCookie, setAuthCookies } from '../utils/cookies.utils';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AdminLoginResponseDto } from '../dto/admin-login-response.dto';
import { AdminPasswordDto } from '../dto/admin-password.dto';
import { AdminSetupResponseDto } from '../dto/admin-setup-response.dto';
import { AdminSetupDto } from '../dto/admin-setup.dto';
import { AdminStatusDto } from '../dto/admin-status.dto';
import { AdminTokenVerificationDto } from '../dto/admin-token-verification.dto';
import { AuthCheckResponseDto } from '../dto/auth-check-response.dto';
import { AuthRequestDto } from '../dto/auth-request.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { LoginDto } from '../dto/login.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { LogoutResponseDto } from '../dto/logout-response.dto';
import { PublicUsersResponseDto } from '../dto/public-users-response.dto';
import { RefreshResponseDto } from '../dto/refresh-response.dto';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';
import type { ValidatedUser } from '../strategies/jwt.strategy';
import { isAdmin } from '../utils/auth.utils';
import { LoginHandler } from '@/application/auth/commands/login/login.handler';
import { LogoutHandler } from '@/application/auth/commands/logout/logout.handler';
import { LoginCommand } from '@/application/auth/commands/login/login.command';
import { LogoutCommand } from '@/application/auth/commands/logout/logout.command';

/**
 * Controller für Authentifizierung-Endpunkte
 *
 * Stellt REST-API-Endpunkte für Benutzerregistrierung und -anmeldung bereit.
 * Alle Endpunkte sind öffentlich zugänglich, da keine Authentifizierung
 * für die Registrierung/Anmeldung erforderlich ist.
 */

@ApiTags('auth')
@Controller({
  path: 'auth',
  version: VERSION_NEUTRAL,
})
@SkipTransform()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly appConfig: AppConfigService,
    private readonly loginHandler: LoginHandler,
    private readonly logoutHandler: LogoutHandler,
  ) {}

  /**
   * Unified Auth - Kombiniert Login und automatische Registrierung
   *
   * Wenn der Benutzer existiert:
   * - Mit Passwort (Admin): Passwort wird geprüft
   * - Ohne Passwort (Normal): Sofortiger Login
   *
   * Wenn der Benutzer nicht existiert:
   * - Automatische Registrierung ohne Passwort
   *
   * @param req - Express Request
   * @param dto - Auth Request mit Username und optionalem Passwort
   * @param res - Express Response für Cookie-Verwaltung
   * @returns Auth Response mit Token und User-Info
   */
  @Post('unified')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 Anfragen pro Minute
  @ApiOperation({
    summary: 'Unified Login & Auto-Register',
    description: 'Vereinheitlichter Endpunkt für Login und automatische Registrierung. Wenn der Benutzer nicht existiert, wird er automatisch angelegt.',
  })
  @ApiBody({
    type: AuthRequestDto,
    description: 'Auth Request mit Username und optionalem Passwort',
  })
  @ApiOkResponse({
    description: 'Erfolgreiche Authentifizierung (Login oder Auto-Registrierung), Tokens werden via Set-Cookie (HTTP-Only) gesetzt: accessToken, refreshToken',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Ungültige Credentials',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Zu viele Anfragen - bitte später erneut versuchen',
  })
  async unifiedAuth(@Body() dto: AuthRequestDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    // Audit-Log für Login-Versuch
    this.logger.log('Authentication attempt initiated', {
      username: dto.username,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });

    try {
      const { accessToken, refreshToken, ...responseDto } = await this.authService.unifiedAuth(dto);

      // Tokens extrahieren und als HTTP-Only Cookies setzen
      const isProduction = this.appConfig.isProduction();
      setAuthCookies(res, accessToken, refreshToken, isProduction);

      // Audit-Log für erfolgreiche Authentifizierung
      this.logger.log('Authentication successful', {
        userId: responseDto.user.id,
        username: responseDto.user.username,
        isNewUser: responseDto.isNewUser,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      });

      // Nur DTO-konforme Daten zurückgeben (ohne Tokens)
      return responseDto;
    } catch (error: unknown) {
      // Audit-Log für fehlgeschlagene Authentifizierung
      this.logger.warn('Authentication failed', {
        username: dto.username,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * User Login via CQRS (LoginCommand)
   *
   * Meldet einen User an und gibt JWT Token zurück:
   * - PASSWORDLESS für USER Role (nur Username)
   * - PASSWORD-REQUIRED für ADMIN/SUPER_ADMIN Role
   *
   * Der Token wird zusätzlich als HTTP-Only Cookie gesetzt (optional für Web-Clients).
   *
   * @param dto - LoginDto mit Username und optional Passwort
   * @param res - Express Response für Cookie-Verwaltung
   * @returns LoginResponseDto mit JWT Token
   * @throws UnauthorizedException bei ungültigen Credentials
   * @throws ForbiddenException wenn Account gesperrt ist
   * @throws BadRequestException bei Validierungsfehlern
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 Anfragen pro Minute
  @ApiOperation({
    summary: 'User Login (PASSWORDLESS für USER, PASSWORD für ADMIN)',
    description: 'Meldet einen User an und gibt JWT Token zurück. PASSWORDLESS Auth für USER Role, PASSWORD-REQUIRED für ADMIN/SUPER_ADMIN.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Login-Daten mit Username und optionalem Passwort',
  })
  @ApiOkResponse({
    description: 'Login erfolgreich - JWT Token wird via Set-Cookie (HTTP-Only) gesetzt: accessToken',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Ungültige Anmeldedaten (falscher Username oder Passwort)',
  })
  @ApiForbiddenResponse({
    description: 'Benutzerkonto gesperrt',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Zu viele Anfragen - bitte später erneut versuchen',
  })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<LoginResponseDto> {
    // 1. LoginCommand erstellen
    const commandResult = LoginCommand.create(dto.username, dto.password);
    if (commandResult.isFailure || !commandResult.value) {
      this.logger.error('Invalid LoginCommand', { error: commandResult.error });
      throw new BadRequestException(commandResult.error ?? 'Ungültige Login-Daten');
    }

    // 2. Command ausführen
    const result = await this.loginHandler.execute(commandResult.value);

    // 3. Error Handling mit spezifischen HTTP Status
    if (result.isFailure) {
      const error = result.error ?? 'Login fehlgeschlagen';
      this.logger.warn('Login failed', { error, username: dto.username });

      // Gesperrter Account → 403 Forbidden
      if (error.includes('gesperrt') || error.includes('locked')) {
        throw new ForbiddenException(error);
      }

      // Alle anderen Fehler → 401 Unauthorized
      throw new UnauthorizedException(error);
    }

    // 4. Cookie setzen (optional, für Web-Clients)
    const token = result.value;
    if (!token) {
      throw new BadRequestException('Login erfolgreich, aber kein Token zurückgegeben');
    }

    const isProduction = this.appConfig.isProduction();
    response.cookie('accessToken', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24h
    });

    this.logger.log('Login successful', { username: dto.username });

    return { token };
  }

  /**
   * Aktiviert Admin-Rechte für den aktuell angemeldeten Benutzer
   *
   * Der angemeldete Benutzer muss sein Passwort eingeben, um seine
   * Admin-Rechte zu aktivieren (sofern er welche besitzt).
   *
   * @param dto - Passwort-Daten
   * @param currentUser - Der aktuell angemeldete Benutzer
   * @param res - Express Response für Cookie-Verwaltung
   * @returns Der Admin-Benutzer mit aktivierten Rechten
   */
  @Post('admin/login')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('auth-token')
  @ApiOperation({
    summary: 'Admin-Rechte aktivieren',
    description: 'Aktiviert Admin-Rechte für den aktuell angemeldeten Benutzer durch Passwort-Eingabe',
  })
  @ApiBody({
    type: AdminPasswordDto,
    description: 'Admin-Passwort zur Aktivierung der Admin-Rechte',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Admin-Rechte erfolgreich aktiviert',
    type: AdminLoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Ungültiges Passwort',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Benutzer hat keine Admin-Rechte',
  })
  async adminLogin(@Body() dto: AdminPasswordDto, @CurrentUser() currentUser: ValidatedUser, @Res({ passthrough: true }) res: Response): Promise<AdminLoginResponseDto> {
    // Validiere die Admin-Rechte mit dem aktuellen Benutzer
    const user = await this.authService.validateAdminCredentials(currentUser.userId, dto.password);

    if (!user) {
      throw new UnauthorizedException('Ungültiges Passwort');
    }

    const token = this.authService.signAdminToken(user);
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    setAdminCookie(res, token, isProduction);

    return toAdminLoginResponseDto(user);
  }

  /**
   * Erneuert Access-Token mit einem gültigen Refresh-Token
   *
   * @param req - Express request mit authentifiziertem Benutzer
   * @param res - Express Response für Cookie-Verwaltung
   * @returns Neues Access-Token
   */
  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Access-Token erneuern',
    description: 'Erneuert das Access-Token mit einem gültigen Refresh-Token aus dem Cookie',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token erfolgreich erneuert',
    type: RefreshResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Ungültiges oder abgelaufenes Refresh-Token',
  })
  async refresh(@Req() req: Request & { user: ValidatedUser }, @Res({ passthrough: true }) res: Response): Promise<RefreshResponseDto> {
    this.logger.debug('Refreshing token for user', { userId: req.user.userId });
    const user = await this.authService.findUserById(req.user.userId);

    if (!user) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    this.logger.debug('User found, generating new tokens.');
    // Neue Tokens generieren
    const accessToken = this.authService.signAccessToken(user);
    const refreshToken = this.authService.signRefreshToken(user);

    this.logger.debug('Tokens generated, setting cookies.');

    // Tokens als HTTP-Only Cookies setzen
    const isProduction = this.appConfig.isProduction();
    setAuthCookies(res, accessToken, refreshToken, isProduction);

    return toRefreshResponseDto();
  }

  /**
   * User Logout via CQRS (LogoutCommand)
   *
   * Meldet einen User ab und löscht die Authentifizierung-Cookies.
   * JWT Token wird automatisch aus dem Cookie extrahiert.
   * MVP: Stateless JWT (Token bleibt gültig bis Expiration 24h).
   * Future: Redis Blacklist für echtes Token-Revocation.
   *
   * @param req - Express Request mit accessToken Cookie
   * @param response - Express Response für Cookie-Verwaltung
   * @throws BadRequestException bei fehlendem oder ungültigem Token
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'User Logout',
    description: 'Meldet den User ab und löscht alle Authentifizierung-Cookies. MVP: Token bleibt gültig bis Expiration.',
  })
  @ApiNoContentResponse({
    description: 'Logout erfolgreich',
  })
  @ApiUnauthorizedResponse({
    description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig',
  })
  @ApiCookieAuth()
  async logout(@Req() req: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    // 1. Token aus Cookie extrahieren (JwtAuthGuard hat bereits validiert)
    const token = req.cookies?.accessToken;

    // 2. LogoutCommand erstellen
    const commandResult = LogoutCommand.create(token);
    if (commandResult.isFailure || !commandResult.value) {
      this.logger.error('Invalid LogoutCommand', { error: commandResult.error });
      throw new BadRequestException(commandResult.error ?? 'Kein Token vorhanden');
    }

    // 3. Command ausführen (MVP: No-Op)
    const result = await this.logoutHandler.execute(commandResult.value);
    if (result.isFailure) {
      this.logger.error('Logout failed', { error: result.error });
      throw new BadRequestException(result.error ?? 'Logout fehlgeschlagen');
    }

    // 4. Cookies löschen
    clearAuthCookies(response, this.appConfig.isProduction());

    this.logger.log('Logout successful (MVP: Token bleibt gültig bis Expiration)');
    // No return - HTTP 204 No Content
  }

  /**
   * Meldet einen Admin ab (entfernt nur das Admin-Token, behält normale Session)
   *
   * @param res - Express Response für Cookie-Verwaltung
   */
  @Post('admin/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin abmelden',
    description: 'Entfernt nur das Admin-Token, behält die normale Benutzer-Session',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Admin erfolgreich abgemeldet',
    type: LogoutResponseDto,
  })
  async adminLogout(@Res({ passthrough: true }) res: Response): Promise<LogoutResponseDto> {
    // Nur Admin-Cookies löschen, normale Auth-Cookies behalten
    clearAdminCookie(res, this.appConfig.isProduction());
    return toLogoutResponseDto();
  }

  /**
   * Richtet das Passwort für einen Admin-Account ein
   *
   * @param dto - Admin-Setup-Daten mit Passwort
   * @param user - Der aktuelle authentifizierte Benutzer
   * @param res - Express Response für Cookie-Verwaltung
   * @returns Erfolgsmeldung und optional das Admin-Token
   */
  @Post('admin/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Admin-Passwort einrichten',
    description: 'Richtet das Passwort für einen Admin-Account ein. Erfordert Authentifizierung.',
  })
  @ApiBody({
    type: AdminSetupDto,
    description: 'Admin-Setup-Daten mit dem zu setzenden Passwort',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Admin-Passwort erfolgreich eingerichtet',
    type: AdminSetupResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Admin-Setup bereits durchgeführt oder ein Benutzer ist kein Admin',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Keine Authentifizierung',
  })
  async adminSetup(@Body() dto: AdminSetupDto, @CurrentUser() user: ValidatedUser, @Res({ passthrough: true }) res: Response): Promise<AdminSetupResponseDto> {
    const result = await this.authService.adminSetup(dto, user);

    const isProduction = this.appConfig.isProduction();
    setAdminCookie(res, result.token, isProduction);
    return toAdminSetupResponseDto(result.user);
  }

  /**
   * Prüft die aktuelle Authentifizierung und gibt Benutzerinformationen zurück
   *
   * Dieser Endpoint gibt immer 200 zurück, auch wenn kein User authentifiziert ist.
   * Das verhindert 401-Fehler beim initialen App-Load.
   *
   * @param req - Express request mit optionalem User
   * @param res
   * @returns Die Benutzerinformationen oder null
   */
  @Get('check')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 Anfragen pro Minute für Token-Refresh
  @ApiOperation({
    summary: 'Authentifizierungsstatus prüfen',
    description: 'Prüft, ob ein Benutzer authentifiziert ist, und gibt dessen Informationen zurück',
  })
  @ApiOkResponse({
    description: 'Authentifizierungsstatus abgerufen',
    type: AuthCheckResponseDto,
  })
  async checkAuth(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthCheckResponseDto> {
    try {
      const token = req.cookies?.accessToken;

      if (!token) {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
          return {
            user: null,
            authenticated: false,
          };
        }

        // Versuche Token-Refresh
        this.logger.log('Token-Refresh attempt initiated from checkAuth endpoint', {
          hasRefreshToken: !!refreshToken,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        const refreshResult = await this.authService.refreshTokens(refreshToken);

        if (!refreshResult) {
          this.logger.warn('Token-Refresh failed - invalid or expired refresh token', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
          return {
            user: null,
            authenticated: false,
          };
        }

        // Setze neue Cookies
        const isProduction = this.appConfig.isProduction();
        setAuthCookies(res, refreshResult.accessToken, refreshResult.refreshToken, isProduction);

        // Audit-Log für erfolgreichen Token-Refresh
        this.logger.log('Token-Refresh successful', {
          userId: refreshResult.user.id,
          username: refreshResult.user.username,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        });

        // Prüfe Admin-Status
        const isAdminAuthenticated = await this.checkAdminToken(req.cookies?.adminToken);

        return {
          user: toUserResponseDto(refreshResult.user),
          authenticated: true,
          isAdminAuthenticated,
        };
      }

      const payload = await this.authService.verifyAccessToken(token);
      if (!payload.userId) {
        return {
          user: null,
          authenticated: false,
        };
      }
      const user = await this.authService.findUserById(payload.userId);

      if (!user) {
        return {
          user: null,
          authenticated: false,
        };
      }

      // Prüfe Admin-Status
      const isAdminAuthenticated = await this.checkAdminToken(req.cookies?.adminToken);

      this.logger.debug('Auth-Check ok', {
        user: user.username,
        isAdminAuthenticated,
      });
      return {
        user: toUserResponseDto(user),
        authenticated: true,
        isAdminAuthenticated,
      };
    } catch (error: unknown) {
      this.logger.warn('Auth-Check failed', { error });
      return {
        user: null,
        authenticated: false,
      };
    }
  }

  /**
   * Gibt eine öffentliche Liste aller Benutzenden zurück
   *
   * Dieser Endpunkt ist öffentlich zugänglich und wird für
   * den Login-Screen verwendet, um verfügbare Benutzende anzuzeigen.
   *
   * @returns Liste mit Benutzernamen und Vollnamen
   */
  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Öffentliche Benutzerliste abrufen',
    description: 'Gibt eine Liste aller verfügbaren Benutzenden für den Login-Screen zurück',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liste der verfügbaren Benutzenden',
    type: PublicUsersResponseDto,
  })
  async getPublicUsers(): Promise<PublicUsersResponseDto> {
    const users = await this.authService.getPublicUsers();
    return { users };
  }

  /**
   * Prüft den Admin-Setup-Status
   *
   * @param user - Der aktuell authentifizierte Benutzer
   * @returns Status-Informationen für das Admin-Setup
   */
  @Get('admin/status')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Admin-Setup-Status abrufen',
    description: 'Prüft, ob ein Admin-Setup verfügbar ist und ob der aktuelle Benutzer berechtigt ist',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Admin-Status erfolgreich abgerufen',
    type: AdminStatusDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Keine gültige Authentifizierung',
  })
  async getAdminStatus(@CurrentUser() user: ValidatedUser): Promise<AdminStatusDto> {
    const fullUser = await this.authService.findUserById(user.userId);
    if (!fullUser) {
      throw new NotFoundException('Benutzer nicht gefunden');
    }

    const adminExists = await this.authService.adminExists();
    const isAdminRole = isAdmin(fullUser.role);
    const hasNoPassword = !fullUser.passwordHash;

    return toAdminStatusResponseDto(adminExists, isAdminRole && hasNoPassword);
  }

  /**
   * Verifiziert die Gültigkeit eines Admin-Tokens
   *
   * Dieser Endpunkt wird vom Frontend beim App-Start aufgerufen,
   * um zu prüfen, ob das gespeicherte Admin-Token noch gültig ist.
   *
   * @returns Status 200, wenn Token gültig ist, 401, wenn ungültig
   */
  @Get('admin/verify')
  @UseGuards(AdminJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Admin-Token verifizieren',
    description: 'Prüft, ob das Admin-Token im Cookie noch gültig ist.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Admin-Token ist gültig',
    type: AdminTokenVerificationDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Admin-Token fehlt oder ist ungültig',
  })
  async verifyAdminToken(): Promise<AdminTokenVerificationDto> {
    return toAdminTokenVerificationDto();
  }

  /**
   * Prüft ob ein Admin-Token gültig ist
   *
   * @param adminToken - Der Admin-Token aus dem Cookie
   * @returns True wenn Admin authentifiziert, sonst false
   */
  private async checkAdminToken(adminToken: string | undefined): Promise<boolean> {
    if (!adminToken) {
      return false;
    }

    try {
      const adminPayload = await this.authService.verifyAdminToken(adminToken);
      if (adminPayload?.isAdmin === true) {
        this.logger.debug('Admin-Token verifiziert', { payload: adminPayload });
        return true;
      }
      this.logger.warn(`⚠️ Invalid admin token found`);
      return false;
    } catch (error: unknown) {
      this.logger.warn(`🍪 Invalid admin token found`, { error });
      return false;
    }
  }
}
