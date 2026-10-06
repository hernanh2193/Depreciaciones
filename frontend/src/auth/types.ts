/** Valores de DEP_USUARIOS.USU_ROL */
export const Rol = {
  ADMINISTRADOR: '1',
  OPERADOR: '2',
  CONSULTAS: '3',
  AUDITORIA: '4',
} as const
export type Rol = (typeof Rol)[keyof typeof Rol]

export const NOMBRE_ROL: Record<Rol, string> = {
  '1': 'Administrador',
  '2': 'Operador',
  '3': 'Consultas',
  '4': 'Auditoría',
}

export interface UsuarioSesion {
  usuario: string
  nombre: string
  rol: Rol
}

export type LoginResultado =
  | { requiereCambio: false; accessToken: string; usuario: UsuarioSesion }
  | { requiereCambio: true }
