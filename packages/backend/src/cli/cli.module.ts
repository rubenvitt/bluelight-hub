import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@/auth/auth.module';
import { AdminResetPasswordCommand, ArchiveOldEinsaetzeCliCommand } from '@/cli/commands';
import { PrismaModule } from '@/prisma/prisma.module';
import { EinsatzApplicationModule } from '@application/einsatz/einsatz-application.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    PrismaModule,
    AuthModule,
    EinsatzApplicationModule,
  ],
  providers: [AdminResetPasswordCommand, ArchiveOldEinsaetzeCliCommand],
  exports: [AdminResetPasswordCommand, ArchiveOldEinsaetzeCliCommand],
})
export class CliModule {}
