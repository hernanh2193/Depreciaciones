import { api, apiArchivo } from './client'

export type ParametroReporte = 'anio' | 'mes' | 'cuenta' | 'relacion' | 'activo'

/** Los 8 reportes del menú REPORTES de Java, con los parámetros que pide cada uno. */
export interface DefReporte {
  clave: string
  titulo: string
  descripcion: string
  parametros: ParametroReporte[]
}

export const REPORTES: Record<string, DefReporte> = {
  'catalogo-cuentas': {
    clave: 'catalogo-cuentas',
    titulo: 'Catálogo de cuentas',
    descripcion: 'Relación de cuentas contables: cuenta, subcuenta, división y porcentaje de depreciación.',
    parametros: [],
  },
  'relacion-cuentas': {
    clave: 'relacion-cuentas',
    titulo: 'Reporte relación de cuentas',
    descripcion: 'Activos de una relación de cuentas con su valor, valor mensual, fecha y estado (excluye anulados).',
    parametros: ['relacion'],
  },
  'depreciacion-activo': {
    clave: 'depreciacion-activo',
    titulo: 'Reporte depreciación activos',
    descripcion: 'Tarjeta auxiliar de control de depreciaciones de un activo, mes a mes.',
    parametros: ['activo'],
  },
  'activos-por-cuenta': {
    clave: 'activos-por-cuenta',
    titulo: 'Reporte activos por cuenta',
    descripcion: 'Activos de una cuenta principal ordenados por subcuenta (excluye anulados).',
    parametros: ['cuenta'],
  },
  'acumulado-mensual': {
    clave: 'acumulado-mensual',
    titulo: 'Reporte acumulado mensual',
    descripcion: 'Depreciación acumulada al mes indicado, por cuenta y subcuenta.',
    parametros: ['anio', 'mes'],
  },
  'resumen-cuenta': {
    clave: 'resumen-cuenta',
    titulo: 'Resumen por cuenta mensual',
    descripcion: 'Valor y depreciación del mes de las subcuentas de una cuenta.',
    parametros: ['anio', 'mes', 'cuenta'],
  },
  'resumen-mensual': {
    clave: 'resumen-mensual',
    titulo: 'Resumen depreciación mensual',
    descripcion: 'Saldo del mes anterior, activos que inician, activos que terminan y total del mes, por subcuenta.',
    parametros: ['anio', 'mes'],
  },
  consolidacion: {
    clave: 'consolidacion',
    titulo: 'Consolidación por año',
    descripcion: 'Depreciación de cada mes del año por activo de una relación, con los acumulados al cierre.',
    parametros: ['relacion', 'anio'],
  },
}

export interface OpcionesReporte {
  cuentas: { valor: number; etiqueta: string }[]
  relaciones: { valor: number; etiqueta: string }[]
}

export const reportesApi = {
  opciones: () => api<OpcionesReporte>('/reportes/opciones'),
  generar: (clave: string, parametros: Partial<Record<ParametroReporte, string>>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(parametros)) if (v) p.set(k, v)
    const qs = p.toString()
    return apiArchivo(`/reportes/${clave}${qs ? `?${qs}` : ''}`)
  },
}
