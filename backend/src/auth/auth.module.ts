import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard, RolesGuard } from './guards.js';
import { UsuariosRepository } from './usuarios.repository.js';

// Global para que los módulos de las siguientes fases puedan usar JwtAuthGuard/RolesGuard.
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRA', '8h') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsuariosRepository, BitacoraService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, BitacoraService],
})
export class AuthModule {}
