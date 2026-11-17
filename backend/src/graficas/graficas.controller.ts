import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards.js';
import { Rol, Roles } from '../auth/roles.js';
import { GraficasRepository } from './graficas.repository.js';

const entero = ({ value }: { value: unknown }) => (value === '' || value === undefined || value === null ? undefined : Number(value));

// Antes del controlador: los decoradores leen el tipo al definir la clase.
export class FiltroCuentasDto {
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsOptional()
  @IsBoolean()
  anulados = false;
}

export class FiltroComprasDto {
  @Transform(entero)
  @IsInt({ message: 'Año no válido' })
  @Min(1950)
  @Max(2100)
  anio: number;

  @Transform(entero)
  @IsOptional()
  @IsInt({ message: 'Cuenta no válida' })
  cuenta?: number;
}

/** Gráficas (menú GRAFICAS de Java): Administrador, Operador y Consultas (Auditoría no las veía). */
@Controller('graficas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMINISTRADOR, Rol.OPERADOR, Rol.CONSULTAS)
export class GraficasController {
  constructor(private readonly repo: GraficasRepository) {}

  @Get('opciones')
  async opciones() {
    const [anios, cuentas] = await Promise.all([this.repo.anios(), this.repo.cuentas()]);
    return { anios, cuentas };
  }

  @Get('cuentas')
  porCuenta(@Query() f: FiltroCuentasDto) {
    return this.repo.porCuenta(f.anulados);
  }

  @Get('compras')
  compras(@Query() f: FiltroComprasDto) {
    return this.repo.comprasPorMes(f.anio, f.cuenta ?? null);
  }
}
