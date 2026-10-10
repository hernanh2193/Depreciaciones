import { Rol } from './types'

/** Roles que pueden crear registros en catálogos (el backend valida lo mismo). */
export function puedeEditarCatalogos(rol: Rol | undefined): boolean {
  return rol === Rol.ADMINISTRADOR || rol === Rol.OPERADOR
}
