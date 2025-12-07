import { Injectable, Logger } from '@nestjs/common';
// biome-ignore lint/style/useImportType: ConfigService needed for DI at runtime
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { isAdmin } from '@/modules/auth/utils/auth.utils';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';

@Injectable()
export class AdminResetPasswordCommand {
  private readonly logger = new Logger(AdminResetPasswordCommand.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async run(args: string[]): Promise<void> {
    const [username, newPassword] = args;

    if (!username || !newPassword) {
      throw new Error('Benutzername und neues Passwort müssen angegeben werden');
    }

    try {
      // Will be implemented in subtask 31.2 and 31.3
      // For now, just basic structure
      this.logger.log(`Resetting password for user: ${username}`);

      await this.resetAdminPassword(username, newPassword);

      this.logger.log(`✅ Passwort erfolgreich zurückgesetzt für Admin: ${username}`);
      this.logger.log(`📅 Zeitstempel: ${new Date().toISOString()}`);
    } catch (error: unknown) {
      this.logger.error(`Failed to reset password for ${username}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  private async resetAdminPassword(username: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.isDeleted) {
      this.logger.error(`❌ Fehler: Benutzer "${username}" wurde nicht gefunden oder ist gelöscht.`);
      throw new Error(`Benutzer "${username}" wurde nicht gefunden oder ist gelöscht.`);
    }

    if (!isAdmin(user.role)) {
      this.logger.error(`❌ Fehler: Benutzer "${username}" ist kein Administrator (Rolle: ${user.role}).`);
      throw new Error(`Benutzer "${username}" ist kein Administrator (Rolle: ${user.role}).`);
    }

    // Get salt rounds from ConfigService with validation
    const configuredSaltRounds = this.configService.get<string>('BCRYPT_SALT_ROUNDS', '10');
    const saltRounds = parseInt(configuredSaltRounds, 10);

    // Validate salt rounds and provide fallback (capped at 14 for security)
    const validSaltRounds = !Number.isNaN(saltRounds) && saltRounds > 0 && saltRounds <= 14 ? saltRounds : 10;

    if (saltRounds !== validSaltRounds) {
      this.logger.warn(`Invalid BCRYPT_SALT_ROUNDS value: ${configuredSaltRounds}. Must be between 1-14 (recommended: 10-12). Using: ${validSaltRounds}`);
    }

    const hash = await bcrypt.hash(newPassword, validSaltRounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    });

    // TODO: Implement session invalidation when sessions are added to the schema
    // This will ensure all active sessions are terminated after password reset
    // await this.prisma.session.deleteMany({
    //   where: { userId: user.id },
    // });

    this.logger.log(`Successfully reset password for admin: ${username}`);
  }
}
