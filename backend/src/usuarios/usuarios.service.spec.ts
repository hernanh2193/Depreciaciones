import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { BitacoraService } from '../bitacora/bitacora.service.js';
import type { Usuario, UsuariosRepository } from './usuarios.repository.js';
import { UsuariosService } from './usuarios.service.js';

const EMPLEADO = { codigo: 2524, nombres: 'JUAN', apellidos: 'PÉREZ', usuario: 'juanp2524', correo: 'juanp@puertoquetzal.gob.gt' };
const USUARIO: Usuario = {
  codigo: 2524,
  usuario: 'juanp2524',
  nombres: 'JUAN',
  apellidos: 'PÉREZ',
  rol: '2',
  estado: 'A',
  correo: 'juanp@puertoquetzal.gob.gt',
  observacion: null,
  usuarioCrea: 'administrador',
  fechaCrea: '2023-06-01',
};
const DATOS = { rol: '2', estado: 'A' as const, correo: null, observacion: 'Contabilidad' };

function crear(repoParcial: Record<string, unknown> = {}) {
  const repo = {
    listar: vi.fn().mockResolvedValue([USUARIO]),
    obtener: vi.fn().mockResolvedValue(null),
    empleado: vi.fn().mockResolvedValue(EMPLEADO),
    existeUsuario: vi.fn().mockResolvedValue(false),
    crear: vi.fn().mockResolvedValue(undefined),
    actualizar: vi.fn().mockResolvedValue(1),
    cambiarClave: vi.fn().mockResolvedValue(1),
    ...repoParcial,
  };
  const bitacora = { registrar: vi.fn() };
  const config = { get: vi.fn((_k: string, def: string) => def) };
  const service = new UsuariosService(
    repo as unknown as UsuariosRepository,
    bitacora as unknown as BitacoraService,
    config as unknown as ConfigService,
  );
  return { service, repo };
}

describe('UsuariosService.crear', () => {
  it('toma nombre, usuario y correo de RRHH y asigna la clave inicial', async () => {
    const { service, repo } = crear();
    await expect(service.crear(2524, DATOS, 'administrador')).resolves.toEqual({ usuario: 'juanp2524' });
    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: 2524,
        nombres: 'JUAN',
        usuario: 'juanp2524',
        clave: 'nuevosistema*20',
        rol: '2',
        correo: 'juanp@puertoquetzal.gob.gt',
      }),
      'administrador',
    );
  });

  it('el correo escrito reemplaza al de RRHH', async () => {
    const { service, repo } = crear();
    await service.crear(2524, { ...DATOS, correo: 'otro@puertoquetzal.gob.gt' }, 'administrador');
    expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ correo: 'otro@puertoquetzal.gob.gt' }), 'administrador');
  });

  it('empleado inexistente en RRHH: 404', async () => {
    const { service } = crear({ empleado: vi.fn().mockResolvedValue(null) });
    await expect(service.crear(9, DATOS, 'administrador')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('código ya registrado: 409 (Java no lo validaba)', async () => {
    const { service, repo } = crear({ obtener: vi.fn().mockResolvedValue(USUARIO) });
    await expect(service.crear(2524, DATOS, 'administrador')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('nombre de usuario en uso: 409', async () => {
    const { service } = crear({ existeUsuario: vi.fn().mockResolvedValue(true) });
    await expect(service.crear(2524, DATOS, 'administrador')).rejects.toThrow('ya está en uso');
  });
});

describe('UsuariosService.actualizar', () => {
  it('actualiza rol, estado, correo y observación', async () => {
    const { service, repo } = crear({ obtener: vi.fn().mockResolvedValue(USUARIO) });
    await service.actualizar(2524, { ...DATOS, rol: '4' }, 'administrador');
    expect(repo.actualizar).toHaveBeenCalledWith(2524, expect.objectContaining({ rol: '4' }));
  });

  it('un administrador no puede desactivarse a sí mismo', async () => {
    const yo = { ...USUARIO, usuario: 'administrador', rol: '1' };
    const { service, repo } = crear({ obtener: vi.fn().mockResolvedValue(yo) });
    await expect(service.actualizar(1, { ...DATOS, rol: '1', estado: 'I' }, 'ADMINISTRADOR')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('un administrador no puede quitarse el rol', async () => {
    const yo = { ...USUARIO, usuario: 'administrador', rol: '1' };
    const { service } = crear({ obtener: vi.fn().mockResolvedValue(yo) });
    await expect(service.actualizar(1, { ...DATOS, rol: '2' }, 'administrador')).rejects.toThrow('rol de Administrador');
  });

  it('usuario inexistente: 404', async () => {
    const { service } = crear();
    await expect(service.actualizar(9, DATOS, 'administrador')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsuariosService.restablecerClave', () => {
  it('deja la clave inicial', async () => {
    const { service, repo } = crear({ obtener: vi.fn().mockResolvedValue(USUARIO) });
    await expect(service.restablecerClave(2524, 'administrador')).resolves.toEqual({ usuario: 'juanp2524' });
    expect(repo.cambiarClave).toHaveBeenCalledWith(2524, 'nuevosistema*20');
  });
});
