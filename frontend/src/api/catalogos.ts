import { api } from './client'

export interface Cuenta {
  codigo: number
  descripcion: string
  porcentaje: number
}

export interface SubCuenta {
  correlativo: number
  codigo: number
  descripcion: string
  porcentaje: number
}

export type Division = SubCuenta

export interface Relacion {
  codigo: number
  cuentaCodigo: number
  cuenta: string
  subCuentaCorrelativo: number
  subCuenta: string
  divisionCorrelativo: number | null
  division: string | null
}

export type EstadoPeriodo = 'R' | 'P'

export interface Periodo {
  correlativo: number
  codigo: number
  fechaInicio: string
  fechaFinal: string
  estado: EstadoPeriodo
}

export interface Opcion {
  valor: number
  etiqueta: string
}

export interface OpcionesRelacion {
  cuentas: Opcion[]
  subCuentas: Opcion[]
  divisiones: Opcion[]
}

export interface NuevoRegistroPorcentaje {
  codigo: number
  descripcion: string
  porcentaje: number
}

const post = <T>(ruta: string, body: unknown) => api<T>(ruta, { method: 'POST', body: JSON.stringify(body) })

export const catalogosApi = {
  cuentas: () => api<Cuenta[]>('/catalogos/cuentas'),
  crearCuenta: (c: NuevoRegistroPorcentaje) => post<void>('/catalogos/cuentas', c),

  subCuentas: () => api<SubCuenta[]>('/catalogos/subcuentas'),
  crearSubCuenta: (c: NuevoRegistroPorcentaje) => post<void>('/catalogos/subcuentas', c),

  divisiones: () => api<Division[]>('/catalogos/divisiones'),
  crearDivision: (c: NuevoRegistroPorcentaje) => post<void>('/catalogos/divisiones', c),

  relaciones: () => api<Relacion[]>('/catalogos/relaciones'),
  opcionesRelacion: () => api<OpcionesRelacion>('/catalogos/relaciones/opciones'),
  crearRelacion: (r: { cuenta: number; subCuenta: number; division: number | null }) =>
    post<void>('/catalogos/relaciones', r),

  periodos: () => api<Periodo[]>('/catalogos/periodos'),
  crearPeriodo: (p: { mes: string; estado: EstadoPeriodo }) =>
    post<{ codigo: number; fechaInicio: string; fechaFinal: string }>('/catalogos/periodos', p),
}
