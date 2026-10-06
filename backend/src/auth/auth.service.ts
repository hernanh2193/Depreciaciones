import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { prepararPasswordParaGuardar, verificarPassword } from './password.js';
import { Rol } from './roles.js';
import { UsuarioDb, UsuariosRepository } from './usuarios.repository.js';

export interface UsuarioSesion {
  usuario: string;
  nombre: string;
  rol: Rol;
}

export interface JwtPayload {
  sub: string;
  nombre: string;
  rol: Rol;
}

export type LoginResultado =
  | { requiereCambio: false; accessToken: string; usuario: UsuarioSesion }
  | { requiereCambio: true };

const CREDENCIALES_INVALIDAS = 'Credenciales no válidas';

@Injectable()
export class AuthService {
  private readonly claveInicial: string;

  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly jwt: JwtService,
    private readonly bitacora: BitacoraService,
    config: ConfigService,
  ) {
    // Clave temporal que el administrador asigna a usuarios nuevos o reiniciados.
    this.claveInicial = config.get<string>('CLAVE_INICIAL', 'nuevosistema*20');
  }

  async login(usuario: string, clave: string): Promise<LoginResultado> {
    const u = await this.validarCredenciales(usuario, clave);

    if (clave === this.claveInicial) {
      return { requiereCambio: true };
    }

    const sesion = this.aSesion(u);
    const payload: JwtPayload = { sub: sesion.usuario, nombre: sesion.nombre, rol: sesion.rol };
    const accessToken = await this.jwt.signAsync(payload);

    this.bitacora.registrar(sesion.usuario, 'Login', 'Inicio de Session');
    return { requiereCambio: false, accessToken, usuario: sesion };
  }

  async cambiarClave(usuario: string, claveActual: string, claveNueva: string): Promise<void> {
    await this.validarCredenciales(usuario, claveActual);

    if (claveNueva === this.claveInicial) {
      throw new BadRequestException('La nueva clave no puede ser la clave inicial');
    }
    if (claveNueva === claveActual) {
      throw new BadRequestException('La nueva clave debe ser diferente a la actual');
    }

    await this.usuarios.actualizarPassword(usuario, prepararPasswordParaGuardar(claveNueva));
    this.bitacora.registrar(usuario, 'CambioPass', 'Cambio de clave');
  }

  private async validarCredenciales(usuario: string, clave: string): Promise<UsuarioDb> {
    const u = await this.usuarios.buscarPorUsuario(usuario);
    // Mismo mensaje para usuario inexistente, clave incorrecta o usuario inactivo.
    if (!u || !verificarPassword(clave, u.USU_PASSWORD) || u.USU_ESTADO === 'I') {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }
    return u;
  }

  private aSesion(u: UsuarioDb): UsuarioSesion {
    const nombre = [u.USU_NOMBRES, u.USU_APELLIDOS].filter(Boolean).join(' ').trim();
    return {
      usuario: u.USU_USUARIO,
      nombre: nombre || u.USU_USUARIO,
      rol: String(u.USU_ROL).trim() as Rol,
    };
  }
}
