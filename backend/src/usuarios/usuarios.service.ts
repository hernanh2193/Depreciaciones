import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prepararPasswordParaGuardar } from '../auth/password.js';
import { Rol } from '../auth/roles.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { codigoOracle, ORA_REGISTRO_DUPLICADO } from '../database/database.service.js';
import { UsuariosRepository, type Usuario } from './usuarios.repository.js';

export interface DatosUsuario {
  rol: string;
  estado: 'A' | 'I';
  correo: string | null;
  observacion: string | null;
}

/**
 * Administración de usuarios (RegistroUser / EditUser de Java).
 * La clave no se muestra ni se escribe: los usuarios nuevos y los restablecidos quedan con la clave inicial
 * y el login los obliga a cambiarla.
 */
@Injectable()
export class UsuariosService {
  private readonly claveInicial: string;

  constructor(
    private readonly repo: UsuariosRepository,
    private readonly bitacora: BitacoraService,
    config: ConfigService,
  ) {
    this.claveInicial = config.get<string>('CLAVE_INICIAL', 'nuevosistema*20');
  }

  listar() {
    return this.repo.listar();
  }

  async obtener(codigo: number): Promise<Usuario> {
    const u = await this.repo.obtener(codigo);
    if (!u) throw new NotFoundException(`No existe el usuario con código ${codigo}`);
    return u;
  }

  /** Datos de RRHH para el formulario de creación, e indica si ya tiene usuario en el sistema. */
  async empleado(codigo: number) {
    const e = await this.repo.empleado(codigo);
    if (!e) throw new NotFoundException(`No existe el empleado ${codigo} en Recursos Humanos`);
    const registrado = await this.repo.obtener(codigo);
    return { ...e, yaRegistrado: !!registrado };
  }

  async crear(codigo: number, datos: DatosUsuario, admin: string) {
    const e = await this.repo.empleado(codigo);
    if (!e) throw new NotFoundException(`No existe el empleado ${codigo} en Recursos Humanos`);
    if (!e.usuario) throw new BadRequestException('El empleado no tiene nombre de usuario en Recursos Humanos');
    if (await this.repo.obtener(codigo)) throw new ConflictException(`El empleado ${codigo} ya tiene usuario en el sistema`);
    if (await this.repo.existeUsuario(e.usuario)) throw new ConflictException(`El nombre de usuario ${e.usuario} ya está en uso`);

    try {
      await this.repo.crear(
        {
          codigo,
          nombres: e.nombres,
          apellidos: e.apellidos,
          usuario: e.usuario,
          clave: prepararPasswordParaGuardar(this.claveInicial),
          ...datos,
          correo: datos.correo ?? e.correo,
        },
        admin,
      );
    } catch (err) {
      if (codigoOracle(err) === ORA_REGISTRO_DUPLICADO) throw new ConflictException(`El empleado ${codigo} ya tiene usuario en el sistema`);
      throw err;
    }
    this.bitacora.registrar(admin, 'RegistroUser', `Usuario ${e.usuario} creado`);
    return { usuario: e.usuario };
  }

  async actualizar(codigo: number, datos: DatosUsuario, admin: string) {
    const actual = await this.obtener(codigo);
    if (esElMismo(actual, admin)) {
      if (datos.estado !== 'A') throw new BadRequestException('No puede desactivar su propio usuario');
      if (datos.rol !== Rol.ADMINISTRADOR) throw new BadRequestException('No puede quitarse a sí mismo el rol de Administrador');
    }
    await this.repo.actualizar(codigo, datos);
    this.bitacora.registrar(admin, 'EditUser', `Usuario ${actual.usuario} actualizado`);
  }

  /** Deja la clave inicial; en su próximo ingreso el usuario deberá cambiarla. */
  async restablecerClave(codigo: number, admin: string) {
    const u = await this.obtener(codigo);
    await this.repo.cambiarClave(codigo, prepararPasswordParaGuardar(this.claveInicial));
    this.bitacora.registrar(admin, 'EditUser', `Clave del usuario ${u.usuario} restablecida`);
    return { usuario: u.usuario };
  }
}

const esElMismo = (u: Usuario, admin: string) => u.usuario.trim().toUpperCase() === admin.trim().toUpperCase();
