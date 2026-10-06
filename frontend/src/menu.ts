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

const pendiente = (titulo: string, ruta: string, roles: Rol[]): OpcionMenu => ({
  titulo,
  ruta,
  roles,
  migrado: false,
})

export const MENU: GrupoMenu[] = [
  {
    titulo: 'Administrar',
    opciones: [
      pendiente('Nuevo usuario', '/admin/usuarios/nuevo', [A]),
      pendiente('Editar usuarios', '/admin/usuarios', [A]),
    ],
  },
  {
    titulo: 'Catálogos',
    opciones: [
      pendiente('Cuenta principal', '/catalogos/cuentas', [A, O, C]),
      pendiente('Sub cuenta', '/catalogos/subcuentas', [A, O, C]),
      pendiente('División cuenta', '/catalogos/division-cuentas', [A, O, C]),
      pendiente('Unificar cuenta', '/catalogos/relacion-cuentas', [A, O, C]),
      pendiente('Periodos', '/catalogos/periodos', [A, O]),
      pendiente('Registro de activos', '/activos/registro', [A, O]),
      pendiente('Modificación de activos', '/activos/modificacion', [A, O]),
      pendiente('Otros porcentajes activos', '/activos/otros-porcentajes', [A, O]),
      pendiente('Traslado de activos', '/activos/traslado', [A, O]),
    ],
  },
  {
    titulo: 'Procesos',
    opciones: [pendiente('Generar depreciación', '/procesos/generar', [A, O])],
  },
  {
    titulo: 'Consultas',
    opciones: [
      pendiente('Buscador de activos', '/consultas/buscar-activo', [A, O, C, AU]),
      pendiente('Consulta relación cuentas', '/consultas/activos', [A, O, C, AU]),
      pendiente('Consulta de cuenta x activos', '/consultas/cuenta', [A, O, C, AU]),
      pendiente('Consulta de depreciaciones', '/consultas/depreciaciones', [A, O, C, AU]),
    ],
  },
  {
    titulo: 'Reportes',
    opciones: [
      pendiente('Catálogo de cuentas', '/reportes/catalogo-cuentas', [A, O, C, AU]),
      pendiente('Relación de cuentas', '/reportes/relacion-cuentas', [A, O, C, AU]),
      pendiente('Depreciación activos', '/reportes/depreciacion-activos', [A, O, C, AU]),
      pendiente('Activos por cuenta', '/reportes/activos-por-cuenta', [A, O, C, AU]),
      pendiente('Acumulado mensual', '/reportes/acumulado-mensual', [A, O, C, AU]),
      pendiente('Resumen por cuenta mensual', '/reportes/resumen-cuenta', [A, O, C, AU]),
      pendiente('Resumen depreciación mensual', '/reportes/resumen', [A, O, C, AU]),
      pendiente('Consolidación por año', '/reportes/consolidacion', [A, O, C, AU]),
    ],
  },
  {
    titulo: 'Gráficas',
    opciones: [
      pendiente('Gráfica por cuenta', '/graficas/cuenta', [A, O, C]),
      pendiente('Compras de activos x año', '/graficas/compras', [A, O, C]),
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
