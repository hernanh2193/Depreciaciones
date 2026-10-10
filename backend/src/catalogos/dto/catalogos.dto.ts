import { Transform } from 'class-transformer';
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

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** DEP_CUENTA: código NUMBER(10), descripción VARCHAR2(100), porcentaje NUMBER(10,0) (entero). */
export class CrearCuentaDto {
  @IsInt({ message: 'El código debe ser un número entero' })
  @Min(1, { message: 'El código debe ser mayor que 0' })
  @Max(9_999_999_999, { message: 'El código es demasiado largo' })
  codigo: number;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar la descripción' })
  @MaxLength(100, { message: 'La descripción admite máximo 100 caracteres' })
  descripcion: string;

  @IsInt({ message: 'El porcentaje de la cuenta debe ser un número entero' })
  @Min(0, { message: 'El porcentaje no puede ser negativo' })
  @Max(100, { message: 'El porcentaje no puede ser mayor que 100' })
  porcentaje: number;
}

/** DEP_SUB_CUENTA: código NUMBER(10), descripción VARCHAR2(300), porcentaje NUMBER(10,0) (entero). */
export class CrearSubCuentaDto {
  @IsInt({ message: 'El código debe ser un número entero' })
  @Min(1, { message: 'El código debe ser mayor que 0' })
  @Max(99_999, { message: 'El código admite máximo 5 dígitos' })
  codigo: number;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar la descripción' })
  @MaxLength(300, { message: 'La descripción admite máximo 300 caracteres' })
  descripcion: string;

  @IsInt({ message: 'El porcentaje de la subcuenta debe ser un número entero' })
  @Min(0, { message: 'El porcentaje no puede ser negativo' })
  @Max(100, { message: 'El porcentaje no puede ser mayor que 100' })
  porcentaje: number;
}

/** DEP_SUB_DIV_CUENTA: igual que subcuenta pero el porcentaje es NUMBER(10,2) (hasta 2 decimales). */
export class CrearDivisionDto {
  @IsInt({ message: 'El código debe ser un número entero' })
  @Min(1, { message: 'El código debe ser mayor que 0' })
  @Max(99_999, { message: 'El código admite máximo 5 dígitos' })
  codigo: number;

  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar la descripción' })
  @MaxLength(300, { message: 'La descripción admite máximo 300 caracteres' })
  descripcion: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El porcentaje admite máximo 2 decimales' })
  @Min(0, { message: 'El porcentaje no puede ser negativo' })
  @Max(100, { message: 'El porcentaje no puede ser mayor que 100' })
  porcentaje: number;
}

export class CrearRelacionDto {
  @IsInt({ message: 'Debe seleccionar una cuenta' })
  cuenta: number;

  @IsInt({ message: 'Debe seleccionar una subcuenta' })
  subCuenta: number;

  /** null u omitido = "Sin división" */
  @IsOptional()
  @IsInt({ message: 'División no válida' })
  division?: number | null;
}

export class CrearPeriodoDto {
  /** Mes del periodo en formato YYYY-MM; las fechas y el código AAAAMM se calculan a partir de él. */
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Debe seleccionar un mes válido' })
  mes: string;

  @IsIn(['R', 'P'], { message: 'El estado debe ser REGISTRADA o PROCESADA' })
  estado: 'R' | 'P';
}
