import { SetMetadata } from '@nestjs/common';

/** Valores de DEP_USUARIOS.USU_ROL (ver menuCtrl.java del sistema Java). */
export enum Rol {
  ADMINISTRADOR = '1',
  OPERADOR = '2',
  CONSULTAS = '3',
  AUDITORIA = '4',
}

export const ROLES_KEY = 'roles';

/** Restringe un endpoint a ciertos roles. Requiere JwtAuthGuard + RolesGuard. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
