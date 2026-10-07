import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { EstadoActivo } from '../activos.types.js';

const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Texto opcional: recorta y convierte '' en null. */
const textoOpcional = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value ?? null;
  const t = value.trim();
  return t === '' ? null : t;
};
const nuloSiVacio = ({ value }: { value: unknown }) => (value === '' || value === undefined ? null : value);

/** Campos de DEP_CONTROL_DEPRECIACION que el usuario captura (longitudes según las columnas). */
export class DatosActivoDto {
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar la descripción' })
  @MaxLength(4000, { message: 'La descripción admite máximo 4000 caracteres' })
  descripcion: string;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'El número de tarjeta admite máximo 50 caracteres' })
  tarjeta: string | null = null;

  @Transform(nuloSiVacio)
  @IsOptional()
  @IsInt({ message: 'La cuenta presupuestaria debe ser un número entero' })
  @Min(0)
  @Max(9_999_999_999)
  cuentaPresupuesto: number | null = null;

  @Matches(FECHA, { message: 'Fecha de inicio no válida' })
  fechaInicio: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El valor original admite máximo 2 decimales' })
  @Min(1.01, { message: 'El valor original debe ser mayor que Q1.00 (valor residual)' })
  @Max(99_999_999_999_999, { message: 'El valor original es demasiado grande' })
  valorOriginal: number;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  noConstancia: string | null = null;

  @Transform(nuloSiVacio)
  @IsOptional()
  @Matches(FECHA, { message: 'Fecha de constancia no válida' })
  fechaConstancia: string | null = null;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  noCur: string | null = null;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'La marca admite máximo 100 caracteres' })
  marca: string | null = null;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  modelo: string | null = null;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  serie: string | null = null;

  @Transform(nuloSiVacio)
  @IsOptional()
  @IsInt({ message: 'El año debe ser un número entero' })
  @Min(1900, { message: 'Año no válido' })
  @Max(2100, { message: 'Año no válido' })
  anio: number | null = null;
}

export class CrearActivoDto extends DatosActivoDto {
  @IsInt({ message: 'Debe seleccionar la relación de cuentas' })
  relacion: number;
}

export class ActualizarActivoDto extends DatosActivoDto {
  @IsIn(['A', 'D', 'I'], { message: 'Estado no válido' })
  estado: EstadoActivo;
}

/** Tramo con un porcentaje distinto (DEP_PORCANTERIOR_DEPRECIACION). Los valores se capturan a mano, como en Java. */
export class CrearOtroPorcentajeDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El valor original admite máximo 2 decimales' })
  @Min(0.01)
  valorOriginal: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El valor mensual admite máximo 2 decimales' })
  @Min(0.01, { message: 'El valor mensual debe ser mayor que 0' })
  valorMensual: number;

  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'El factor admite máximo 6 decimales' })
  @Min(0.000001, { message: 'El factor debe ser mayor que 0' })
  @Max(1)
  factor: number;

  @Matches(FECHA, { message: 'Fecha de inicio no válida' })
  fechaInicio: string;

  @Matches(FECHA, { message: 'Fecha final no válida' })
  fechaFinal: string;
}

export class BuscarActivosDto {
  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  texto: string | null = null;

  @Transform(nuloSiVacio)
  @IsOptional()
  @IsIn(['A', 'D', 'I'])
  estado: EstadoActivo | null = null;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limite = 100;
}
