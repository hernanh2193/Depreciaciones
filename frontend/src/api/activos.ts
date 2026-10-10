import { api } from './client'

export type EstadoActivo = 'A' | 'D' | 'I'

export const NOMBRE_ESTADO_ACTIVO: Record<EstadoActivo, string> = {
  A: 'ACTIVO',
  D: 'DEPRECIADO',
  I: 'ANULADO',
}

export interface ActivoResumen {
  correlativo: number
  tarjeta: string | null
  descripcion: string
  relacion: string
  fechaInicio: string | null
  valorOriginal: number
  valorMensual: number
  estado: EstadoActivo
}

export interface Activo {
  correlativo: number
  relacionCodigo: number
  cuenta: string
  subCuenta: string
  division: string
  porcentaje: number
  descripcion: string
  tarjeta: string | null
  cuentaPresupuesto: number | null
  fechaInicio: string | null
  fechaFinal: string | null
  valorOriginal: number
  valorMensual: number
  factor: number
  estado: EstadoActivo
  noConstancia: string | null
  fechaConstancia: string | null
  noCur: string | null
  marca: string | null
  modelo: string | null
  serie: string | null
  anio: number | null
  usuarioCrea: string | null
  fechaCrea: string | null
  usuarioMod: string | null
  fechaMod: string | null
  depreciacionAcumulada: number
  valorLibros: number | null
  mesesGenerados: number
  tieneOtroPorcentaje: boolean
}

export interface DetalleDepreciacion {
  correlativo: number
  periodo: number
  descripcion: string | null
  saldoInicial: number
  factor: number
  depreciacionMes: number
  depreciacionAcumulada: number
  valorLibros: number
  observaciones: string | null
}

export interface OtroPorcentaje {
  correlativo: number
  fechaInicio: string | null
  fechaFinal: string | null
  valorOriginal: number
  valorMensual: number
  factor: number
}

export interface RelacionConPorcentaje {
  codigo: number
  etiqueta: string
  porcentaje: number
}

/** Lo que el formulario envía (números como number, opcionales como '' o null). */
export interface DatosActivo {
  descripcion: string
  tarjeta: string
  cuentaPresupuesto: number | ''
  fechaInicio: string
  valorOriginal: number
  noConstancia: string
  fechaConstancia: string
  noCur: string
  marca: string
  modelo: string
  serie: string
  anio: number | ''
}

const enviar = <T>(metodo: 'POST' | 'PUT', ruta: string, body?: unknown) =>
  api<T>(ruta, { method: metodo, body: body === undefined ? undefined : JSON.stringify(body) })

export const activosApi = {
  relaciones: () => api<RelacionConPorcentaje[]>('/activos/relaciones'),
  buscar: (texto: string, estado: EstadoActivo | '', limite = 100) => {
    const p = new URLSearchParams({ limite: String(limite) })
    if (texto.trim()) p.set('texto', texto.trim())
    if (estado) p.set('estado', estado)
    return api<ActivoResumen[]>(`/activos?${p}`)
  },
  obtener: (id: number) => api<Activo>(`/activos/${id}`),
  crear: (d: DatosActivo & { relacion: number }) =>
    enviar<{ correlativo: number; factor: number; valorMensual: number }>('POST', '/activos', d),
  actualizar: (id: number, d: DatosActivo & { estado: EstadoActivo }) =>
    enviar<{ factor: number; valorMensual: number; regenerarSugerido: boolean }>('PUT', `/activos/${id}`, d),
  detalle: (id: number) => api<DetalleDepreciacion[]>(`/activos/${id}/detalle`),
  regenerar: (id: number) => enviar<Activo>('POST', `/activos/${id}/regenerar`),
  otrosPorcentajes: (id: number) => api<OtroPorcentaje[]>(`/activos/${id}/otros-porcentajes`),
  crearOtroPorcentaje: (id: number, o: Omit<OtroPorcentaje, 'correlativo'>) =>
    enviar<void>('POST', `/activos/${id}/otros-porcentajes`, o),
  regenerarConOtroPorcentaje: (id: number) => enviar<Activo>('POST', `/activos/${id}/otros-porcentajes/regenerar`),
}

/** Mismo cálculo que el backend (y que el sistema Java), para mostrar la vista previa. */
export function factorMensual(porcentajeAnual: number): number {
  const rs = Math.fround(Math.fround(Math.fround(porcentajeAnual) / 12) / 100)
  return Number(rs.toFixed(6))
}

export function valorMensual(valorOriginal: number, factor: number): number {
  return Math.round(((valorOriginal - 1) * factor + Number.EPSILON) * 100) / 100
}
