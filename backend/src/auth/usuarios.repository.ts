import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export interface UsuarioDb {
  USU_USUARIO: string;
  USU_NOMBRES: string | null;
  USU_APELLIDOS: string | null;
  USU_PASSWORD: string | null;
  USU_ROL: string | number;
  USU_ESTADO: string | null;
}

@Injectable()
export class UsuariosRepository {
  constructor(private readonly db: DatabaseService) {}

  async buscarPorUsuario(usuario: string): Promise<UsuarioDb | null> {
    const rows = await this.db.query<UsuarioDb>(
      `SELECT usu_usuario, usu_nombres, usu_apellidos, usu_password, usu_rol, usu_estado
         FROM depreciaciones.dep_usuarios
        WHERE usu_usuario = :usuario`,
      { usuario },
    );
    return rows[0] ?? null;
  }

  async actualizarPassword(usuario: string, password: string): Promise<boolean> {
    const result = await this.db.execute(
      `UPDATE depreciaciones.dep_usuarios
          SET usu_password = :password
        WHERE usu_usuario = :usuario`,
      { password, usuario },
    );
    return (result.rowsAffected ?? 0) > 0;
  }
}
