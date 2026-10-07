export type EstadoActivo = 'A' | 'D' | 'I';

/** Fila de la búsqueda de activos. */
export interface ActivoResumen {
  correlativo: number;
  tarjeta: string | null;
  descripcion: string;
  relacion: string;
  fechaInicio: string | null;
  valorOriginal: number;
  valorMensual: number;
  estado: EstadoActivo;
}

/** Activo completo (DEP_CONTROL_DEPRECIACION + relación de cuentas). */
export interface Activo {
  correlativo: number;
  relacionCodigo: number;
  cuenta: string;
  subCuenta: string;
  division: string;
  porcentaje: number;
  descripcion: string;
  tarjeta: string | null;
  cuentaPresupuesto: number | null;
  fechaInicio: string | null;
  fechaFinal: string | null;
  valorOriginal: number;
  valorMensual: number;
  factor: number;
  estado: EstadoActivo;
  noConstancia: string | null;
  fechaConstancia: string | null;
  noCur: string | null;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  anio: number | null;
  usuarioCrea: string | null;
  fechaCrea: string | null;
  usuarioMod: string | null;
  fechaMod: string | null;
  /** Depreciación acumulada del último mes generado (0 si no hay detalle). */
  depreciacionAcumulada: number;
  valorLibros: number | null;
  mesesGenerados: number;
  tieneOtroPorcentaje: boolean;
}

/** Fila de DEP_DETCTRL_DEPRECIACION. */
export interface DetalleDepreciacion {
  correlativo: number;
  periodo: number;
  descripcion: string | null;
  saldoInicial: number;
  factor: number;
  depreciacionMes: number;
  depreciacionAcumulada: number;
  valorLibros: number;
  observaciones: string | null;
}

/** Fila de DEP_PORCANTERIOR_DEPRECIACION. */
export interface OtroPorcentaje {
  correlativo: number;
  fechaInicio: string | null;
  fechaFinal: string | null;
  valorOriginal: number;
  valorMensual: number;
  factor: number;
}

/** Relación de cuentas con su porcentaje (división si existe, si no subcuenta). */
export interface RelacionConPorcentaje {
  codigo: number;
  etiqueta: string;
  porcentaje: number;
}

/** Datos editables de un activo (lo que se escribe en DEP_CONTROL_DEPRECIACION). */
export interface DatosActivo {
  descripcion: string;
  tarjeta: string | null;
  cuentaPresupuesto: number | null;
  fechaInicio: string;
  valorOriginal: number;
  noConstancia: string | null;
  fechaConstancia: string | null;
  noCur: string | null;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  anio: number | null;
}
