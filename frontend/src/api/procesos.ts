import { api } from './client'

export type CategoriaProceso = 'NORMAL' | 'SALTO' | 'SIN_DETALLE' | 'MENSUAL_CERO'

export const NOMBRE_CATEGORIA: Record<CategoriaProceso, string> = {
  NORMAL: 'Normal',
  SALTO: 'Con salto',
  SIN_DETALLE: 'Sin detalle',
  MENSUAL_CERO: 'Mensual 0',
}

export interface ResumenCuenta {
  cuenta: number
  descripcion: string
  activos: number
  ultimoPeriodo: number | null
  siguientePeriodo: number | null
}

export interface ActivoProceso {
  correlativo: number
  descripcion: string
  fechaInicio: string | null
  valorOriginal: number
  valorMensual: number
  ultimoPeriodo: number | null
  mesesGenerados: number
  mesesSalto: number
  ultimoMes: boolean
  categoria: CategoriaProceso
}

export interface VistaProceso {
  cuenta: number
  periodo: { codigo: number; estado: string | null; fechaInicio: string; fechaFinal: string }
  totales: Record<CategoriaProceso, number> & { activos: number; terminan: number }
  bloqueos: string[]
  advertencias: string[]
  activos: ActivoProceso[]
}

export interface ResultadoProceso {
  mesesGenerados: number
  activosTerminados: number
  esperados: number
}

export interface ActivoAtrasado {
  correlativo: number
  descripcion: string
  fechaInicio: string | null
  valorMensual: number
  ultimoPeriodo: number | null
  mesesFaltantes: number | null
  tienePeriodoInicio: number
}

export interface VistaPonerAlDia {
  cuenta: number
  periodoActual: number
  sinDetalle: ActivoAtrasado[]
  atrasados: ActivoAtrasado[]
  periodos: number[]
  mesesEstimados: number
  bloqueos: string[]
}

export interface EstadoPonerAlDia {
  cuenta: number
  usuario: string
  inicio: string
  fin: string | null
  fase: 'sin-detalle' | 'mensual' | 'terminado' | 'error'
  avance: number
  total: number
  detalle: string
  activosCompletados: number
  periodosProcesados: number
  errores: string[]
}

export const procesosApi = {
  vistaPonerAlDia: (cuenta: number) => api<VistaPonerAlDia>(`/procesos/depreciacion/poner-al-dia/vista?cuenta=${cuenta}`),
  iniciarPonerAlDia: (cuenta: number) =>
    api<EstadoPonerAlDia>('/procesos/depreciacion/poner-al-dia', { method: 'POST', body: JSON.stringify({ cuenta }) }),
  /** null si no se ha ejecutado desde que arrancó el servidor (la API responde {}). */
  estadoPonerAlDia: async () => {
    const e = await api<Partial<EstadoPonerAlDia>>('/procesos/depreciacion/poner-al-dia/estado')
    return e.cuenta === undefined ? null : (e as EstadoPonerAlDia)
  },
  resumen: () => api<ResumenCuenta[]>('/procesos/depreciacion/resumen'),
  vista: (cuenta: number, periodo: number) =>
    api<VistaProceso>(`/procesos/depreciacion/vista?cuenta=${cuenta}&periodo=${periodo}`),
  generar: (cuenta: number, periodo: number, aceptarAdvertencias: boolean) =>
    api<ResultadoProceso>('/procesos/depreciacion/generar', {
      method: 'POST',
      body: JSON.stringify({ cuenta, periodo, aceptarAdvertencias }),
    }),
}
