import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export interface Usuario {
  codigo: number;
  usuario: string;
  nombres: string;
  apellidos: string;
  rol: string;
  estado: 'A' | 'I';
  correo: string | null;
  observacion: string | null;
  usuarioCrea: string | null;
  fechaCrea: string | null;
}

export interface EmpleadoRrhh {
  codigo: number;
  nombres: string;
  apellidos: string;
  usuario: string | null;
  correo: string | null;
}

/** DEP_USUARIOS (UsuariosDal / EditUserDal de Java). Nunca se lee ni se devuelve USU_PASSWORD. */
@Injectable()
export class UsuariosRepository {
  constructor(private readonly db: DatabaseService) {}

  listar(): Promise<Usuario[]> {
    return this.db.query<Usuario>(
      `SELECT usu_codigo "codigo", usu_usuario "usuario", usu_nombres "nombres", usu_apellidos "apellidos",
              TO_CHAR(usu_rol) "rol", usu_estado "estado", usu_correo "correo", usu_observacion "observacion",
              usu_usuario_crea "usuarioCrea", TO_CHAR(usu_fecha_crea, 'YYYY-MM-DD') "fechaCrea"
         FROM depreciaciones.dep_usuarios
        ORDER BY usu_estado, usu_nombres, usu_apellidos`,
    );
  }

  async obtener(codigo: number): Promise<Usuario | null> {
    const r = await this.db.query<Usuario>(
      `SELECT usu_codigo "codigo", usu_usuario "usuario", usu_nombres "nombres", usu_apellidos "apellidos",
              TO_CHAR(usu_rol) "rol", usu_estado "estado", usu_correo "correo", usu_observacion "observacion",
              usu_usuario_crea "usuarioCrea", TO_CHAR(usu_fecha_crea, 'YYYY-MM-DD') "fechaCrea"
         FROM depreciaciones.dep_usuarios WHERE usu_codigo = :codigo`,
      { codigo },
    );
    return r[0] ?? null;
  }

  /** Datos del empleado en RRHH (vista RHEPQ.EMP_DEPRECIA_USUARIOS, la misma que usaba Java). */
  async empleado(codigo: number): Promise<EmpleadoRrhh | null> {
    const r = await this.db.query<EmpleadoRrhh>(
      `SELECT codigo "codigo", TRIM(nombre) "nombres", TRIM(apellido) "apellidos",
              TRIM(usuario) "usuario", LOWER(TRIM(correo)) "correo"
         FROM rhepq.emp_deprecia_usuarios WHERE codigo = :codigo`,
      { codigo },
    );
    return r[0] ?? null;
  }

  async existeUsuario(usuario: string): Promise<boolean> {
    const r = await this.db.query<{ N: number }>(
      `SELECT COUNT(*) n FROM depreciaciones.dep_usuarios WHERE UPPER(TRIM(usu_usuario)) = UPPER(TRIM(:usuario))`,
      { usuario },
    );
    return r[0].N > 0;
  }

  async crear(
    u: Omit<Usuario, 'usuarioCrea' | 'fechaCrea'> & { clave: string },
    creadoPor: string,
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO depreciaciones.dep_usuarios
              (usu_codigo, usu_nombres, usu_apellidos, usu_usuario, usu_password, usu_rol, usu_estado,
               usu_correo, usu_observacion, usu_usuario_crea, usu_fecha_crea)
       VALUES (:codigo, UPPER(:nombres), UPPER(:apellidos), :usuario, :clave, :rol, :estado,
               LOWER(:correo), :observacion, :creadoPor, SYSDATE)`,
      {
        codigo: u.codigo,
        nombres: u.nombres,
        apellidos: u.apellidos,
        usuario: u.usuario,
        clave: u.clave,
        rol: Number(u.rol),
        estado: u.estado,
        correo: u.correo,
        observacion: u.observacion,
        creadoPor,
      },
    );
  }

  async actualizar(codigo: number, d: Pick<Usuario, 'rol' | 'estado' | 'correo' | 'observacion'>): Promise<number> {
    const r = await this.db.execute(
      `UPDATE depreciaciones.dep_usuarios
          SET usu_rol = :rol, usu_estado = :estado, usu_correo = LOWER(:correo), usu_observacion = :observacion
        WHERE usu_codigo = :codigo`,
      { rol: Number(d.rol), estado: d.estado, correo: d.correo, observacion: d.observacion, codigo },
    );
    return r.rowsAffected ?? 0;
  }

  async cambiarClave(codigo: number, clave: string): Promise<number> {
    const r = await this.db.execute(`UPDATE depreciaciones.dep_usuarios SET usu_password = :clave WHERE usu_codigo = :codigo`, {
      clave,
      codigo,
    });
    return r.rowsAffected ?? 0;
  }
}
