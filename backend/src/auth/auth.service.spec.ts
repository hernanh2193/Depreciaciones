import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { BitacoraService } from '../bitacora/bitacora.service.js';
import { AuthService } from './auth.service.js';
import type { UsuarioDb, UsuariosRepository } from './usuarios.repository.js';

const CLAVE_INICIAL = 'nuevosistema*20';

function crearServicio(usuario: UsuarioDb | null) {
  const repo = {
    buscarPorUsuario: vi.fn().mockResolvedValue(usuario),
    actualizarPassword: vi.fn().mockResolvedValue(true),
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('token-firmado') };
  const bitacora = { registrar: vi.fn() };
  const config = { get: vi.fn((_k: string, def: string) => def) };
  const service = new AuthService(
    repo as unknown as UsuariosRepository,
    jwt as unknown as JwtService,
    bitacora as unknown as BitacoraService,
    config as unknown as ConfigService,
  );
  return { service, repo, jwt, bitacora };
}

const usuarioActivo: UsuarioDb = {
  USU_USUARIO: 'jperez',
  USU_NOMBRES: 'Juan',
  USU_APELLIDOS: 'Pérez',
  USU_PASSWORD: 'secreta123',
  USU_ROL: 2,
  USU_ESTADO: 'A',
};

describe('AuthService.login', () => {
  it('devuelve token y datos de sesión con credenciales correctas', async () => {
    const { service, jwt, bitacora } = crearServicio(usuarioActivo);

    const res = await service.login('jperez', 'secreta123');

    expect(res).toEqual({
      requiereCambio: false,
      accessToken: 'token-firmado',
      usuario: { usuario: 'jperez', nombre: 'Juan Pérez', rol: '2' },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'jperez', nombre: 'Juan Pérez', rol: '2' });
    expect(bitacora.registrar).toHaveBeenCalledWith('jperez', 'Login', 'Inicio de Session');
  });

  it('rechaza clave incorrecta', async () => {
    const { service } = crearServicio(usuarioActivo);
    await expect(service.login('jperez', 'otra')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza usuario inexistente', async () => {
    const { service } = crearServicio(null);
    await expect(service.login('nadie', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza usuario inactivo aunque la clave sea correcta', async () => {
    const { service } = crearServicio({ ...usuarioActivo, USU_ESTADO: 'I' });
    await expect(service.login('jperez', 'secreta123')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('pide cambio de clave (sin token) cuando entra con la clave inicial', async () => {
    const { service, jwt } = crearServicio({ ...usuarioActivo, USU_PASSWORD: CLAVE_INICIAL });

    await expect(service.login('jperez', CLAVE_INICIAL)).resolves.toEqual({ requiereCambio: true });
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('no acepta la clave inicial si el usuario ya tiene otra clave', async () => {
    const { service } = crearServicio(usuarioActivo);
    await expect(service.login('jperez', CLAVE_INICIAL)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.cambiarClave', () => {
  it('actualiza la clave cuando la actual es correcta', async () => {
    const { service, repo } = crearServicio({ ...usuarioActivo, USU_PASSWORD: CLAVE_INICIAL });

    await service.cambiarClave('jperez', CLAVE_INICIAL, 'NuevaClave2026');

    expect(repo.actualizarPassword).toHaveBeenCalledWith('jperez', 'NuevaClave2026');
  });

  it('no permite usar la clave inicial como nueva clave', async () => {
    const { service, repo } = crearServicio(usuarioActivo);

    await expect(service.cambiarClave('jperez', 'secreta123', CLAVE_INICIAL)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.actualizarPassword).not.toHaveBeenCalled();
  });

  it('no cambia nada si la clave actual es incorrecta', async () => {
    const { service, repo } = crearServicio(usuarioActivo);

    await expect(service.cambiarClave('jperez', 'mala', 'NuevaClave2026')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(repo.actualizarPassword).not.toHaveBeenCalled();
  });
});
