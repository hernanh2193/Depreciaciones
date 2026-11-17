import type { Activo, DetalleDepreciacion, EstadoActivo } from './activos'
import { api } from './client'

export interface ActivoConsulta {
  correlativo: number
  tarjeta: string | null
  cuentaPresupuesto: number | null
  descripcion: string
  cuenta: number
  relacion: number
  subCuenta: string
  division: string
  fechaInicio: string | null
  fechaFinal: string | null
  valorOriginal: number
  valorMensual: number
  depreciacionAcumulada: number
  valorLibros: number | null
  ultimoPeriodo: number | null
  estado: EstadoActivo
  noConstancia: string | null
}

export interface TotalesConsulta {
  activos: number
  valorOriginal: number
  valorMensual: number
  depreciacionAcumulada: number
  valorLibros: number
}

export interface FiltroConsulta {
  texto: string
  estado: EstadoActivo | ''
  cuenta: string
  relacion: string
}

export interface OpcionesConsulta {
  cuentas: { valor: number; etiqueta: string }[]
  relaciones: { valor: number; etiqueta: string; cuenta: number }[]
}

export const consultasApi = {
  opciones: () => api<OpcionesConsulta>('/consultas/opciones'),
  activos: (f: FiltroConsulta, limite: number) => {
    const p = new URLSearchParams({ limite: String(limite) })
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v).trim())
    return api<{ filas: ActivoConsulta[]; totales: TotalesConsulta; limite: number }>(`/consultas/activos?${p}`)
  },
  activo: (id: number) => api<Activo>(`/consultas/activos/${id}`),
  depreciacion: (id: number) => api<DetalleDepreciacion[]>(`/consultas/activos/${id}/depreciacion`),
}
