import type { Activo, DatosActivo } from '../../api/activos'

/** Estado del formulario de activo: todo como texto, igual que los <input>. */
export type FormActivo = Omit<DatosActivo, 'valorOriginal' | 'cuentaPresupuesto' | 'anio'> & {
  valorOriginal: string
  cuentaPresupuesto: string
  anio: string
}

export const FORM_VACIO: FormActivo = {
  descripcion: '',
  tarjeta: '',
  cuentaPresupuesto: '',
  fechaInicio: '',
  valorOriginal: '',
  noConstancia: '',
  fechaConstancia: '',
  noCur: '',
  marca: '',
  modelo: '',
  serie: '',
  anio: '',
}

/** Convierte el formulario (todo texto) a lo que espera la API. */
export function aDatos(f: FormActivo): DatosActivo {
  return {
    ...f,
    valorOriginal: Number(f.valorOriginal),
    cuentaPresupuesto: f.cuentaPresupuesto === '' ? '' : Number(f.cuentaPresupuesto),
    anio: f.anio === '' ? '' : Number(f.anio),
  }
}

/** Carga un activo existente en el formulario. */
export function desdeActivo(a: Activo): FormActivo {
  const t = (v: string | number | null) => (v === null ? '' : String(v))
  return {
    descripcion: a.descripcion ?? '',
    tarjeta: t(a.tarjeta),
    cuentaPresupuesto: t(a.cuentaPresupuesto),
    fechaInicio: t(a.fechaInicio),
    valorOriginal: t(a.valorOriginal),
    noConstancia: t(a.noConstancia),
    fechaConstancia: t(a.fechaConstancia),
    noCur: t(a.noCur),
    marca: t(a.marca),
    modelo: t(a.modelo),
    serie: t(a.serie),
    anio: t(a.anio),
  }
}
