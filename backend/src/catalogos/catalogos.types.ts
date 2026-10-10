export interface Cuenta {
  codigo: number;
  descripcion: string;
  porcentaje: number;
}

export interface SubCuenta {
  correlativo: number;
  codigo: number;
  descripcion: string;
  porcentaje: number;
}

/** Misma estructura que SubCuenta (tabla DEP_SUB_DIV_CUENTA). */
export type Division = SubCuenta;

export interface Relacion {
  codigo: number;
  cuentaCodigo: number;
  cuenta: string;
  subCuentaCorrelativo: number;
  subCuenta: string;
  divisionCorrelativo: number | null;
  division: string | null;
}

export type EstadoPeriodo = 'R' | 'P';

export interface Periodo {
  correlativo: number;
  codigo: number;
  /** YYYY-MM-DD */
  fechaInicio: string;
  /** YYYY-MM-DD */
  fechaFinal: string;
  estado: EstadoPeriodo;
}

/** Opción para listas desplegables. */
export interface Opcion {
  valor: number;
  etiqueta: string;
}
