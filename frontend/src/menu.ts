import { Rol } from './auth/types'

/**
 * Menú del sistema (equivalente a menu.zul + menuCtrl.java).
 * `roles` controla solo la visibilidad; cada endpoint del backend valida el rol por su cuenta.
 * `migrado: false` muestra la opción como "pendiente de migración".
 */
export interface OpcionMenu {
  titulo: string
  ruta: string
  roles: Rol[]
  migrado: boolean
}

export interface GrupoMenu {
  titulo: string
  opciones: OpcionMenu[]
}

const { ADMINISTRADOR: A, OPERADOR: O, CONSULTAS: C, AUDITORIA: AU } = Rol

// Todas las opciones del menú Java ya están migradas. Para una opción nueva aún sin pantalla, usar migrado: false.
const migrado = (titulo: string, ruta: string, roles: Rol[]): OpcionMenu => ({
  titulo,
  ruta,
  roles,
  migrado: true,
})

export const MENU: GrupoMenu[] = [
  {
    titulo: 'Administrar',
    opciones: [
      // En Java eran "Nuevo usuario" y "Editar usuarios"; ahora una sola pantalla con "Crear usuario" y "Editar"
      migrado('Usuarios', '/admin/usuarios', [A]),
    ],
  },
  {
    titulo: 'Catálogos',
    opciones: [
      migrado('Cuenta principal', '/catalogos/cuentas', [A, O, C]),
      migrado('Sub cuenta', '/catalogos/subcuentas', [A, O, C]),
      migrado('División cuenta', '/catalogos/division-cuentas', [A, O, C]),
      migrado('Unificar cuenta', '/catalogos/relacion-cuentas', [A, O, C]),
      migrado('Periodos', '/catalogos/periodos', [A, O]),
      migrado('Registro de activos', '/activos/registro', [A, O]),
      migrado('Modificación de activos', '/activos/modificacion', [A, O]),
      migrado('Otros porcentajes activos', '/activos/otros-porcentajes', [A, O]),
      migrado('Traslado de activos', '/activos/traslado', [A, O]),
    ],
  },
  {
    titulo: 'Procesos',
    opciones: [migrado('Generar depreciación', '/procesos/generar', [A, O])],
  },
  {
    titulo: 'Consultas',
    opciones: [
      migrado('Buscador de activos', '/consultas/buscar-activo', [A, O, C, AU]),
      migrado('Consulta relación cuentas', '/consultas/activos', [A, O, C, AU]),
      migrado('Consulta de cuenta x activos', '/consultas/cuenta', [A, O, C, AU]),
      migrado('Consulta de depreciaciones', '/consultas/depreciaciones', [A, O, C, AU]),
    ],
  },
  {
    titulo: 'Reportes',
    opciones: [
      migrado('Catálogo de cuentas', '/reportes/catalogo-cuentas', [A, O, C, AU]),
      migrado('Relación de cuentas', '/reportes/relacion-cuentas', [A, O, C, AU]),
      migrado('Depreciación activos', '/reportes/depreciacion-activo', [A, O, C, AU]),
      migrado('Activos por cuenta', '/reportes/activos-por-cuenta', [A, O, C, AU]),
      migrado('Acumulado mensual', '/reportes/acumulado-mensual', [A, O, C, AU]),
      migrado('Resumen por cuenta mensual', '/reportes/resumen-cuenta', [A, O, C, AU]),
      migrado('Resumen depreciación mensual', '/reportes/resumen-mensual', [A, O, C, AU]),
      migrado('Consolidación por año', '/reportes/consolidacion', [A, O, C, AU]),
    ],
  },
  {
    titulo: 'Gráficas',
    opciones: [
      migrado('Gráfica por cuenta', '/graficas/cuenta', [A, O, C]),
      migrado('Compras de activos x año', '/graficas/compras', [A, O, C]),
    ],
  },
]

export function menuParaRol(rol: Rol): GrupoMenu[] {
  return MENU.map((g) => ({ ...g, opciones: g.opciones.filter((o) => o.roles.includes(rol)) })).filter(
    (g) => g.opciones.length > 0,
  )
}

export function buscarOpcion(ruta: string): OpcionMenu | undefined {
  return MENU.flatMap((g) => g.opciones).find((o) => o.ruta === ruta)
}
