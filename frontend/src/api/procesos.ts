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

export const procesosApi = {
  resumen: () => api<ResumenCuenta[]>('/procesos/depreciacion/resumen'),
  vista: (cuenta: number, periodo: number) =>
    api<VistaProceso>(`/procesos/depreciacion/vista?cuenta=${cuenta}&periodo=${periodo}`),
  generar: (cuenta: number, periodo: number, aceptarAdvertencias: boolean) =>
    api<ResultadoProceso>('/procesos/depreciacion/generar', {
      method: 'POST',
      body: JSON.stringify({ cuenta, periodo, aceptarAdvertencias }),
    }),
}
