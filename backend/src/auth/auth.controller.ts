import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService, type UsuarioSesion } from './auth.service.js';
import { CambiarClaveDto } from './dto/cambiar-clave.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard, type RequestConUsuario } from './guards.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.usuario, dto.clave);
  }

  @Post('cambiar-clave')
  @HttpCode(204)
  async cambiarClave(@Body() dto: CambiarClaveDto) {
    await this.auth.cambiarClave(dto.usuario, dto.claveActual, dto.claveNueva);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: RequestConUsuario): UsuarioSesion {
    return { usuario: req.user.sub, nombre: req.user.nombre, rol: req.user.rol };
  }
}
