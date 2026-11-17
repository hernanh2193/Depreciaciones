import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ActivosRepository } from '../activos/activos.repository.js';
import type { EstadoActivo } from '../activos/activos.types.js';
import { JwtAuthGuard, RolesGuard } from '../auth/guards.js';
import { Rol, Roles } from '../auth/roles.js';
import { ConsultasRepository } from './consultas.repository.js';

const vacioANulo = ({ value }: { value: unknown }) => (value === '' || value === undefined ? null : value);
/** '' -> null y texto -> número en un solo paso (con @Type, '' se convertiría en 0 antes de llegar aquí). */
const numeroONulo = ({ value }: { value: unknown }) => (value === '' || value === undefined || value === null ? null : Number(value));

export class FiltroConsultaDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() ? value.trim() : null))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  texto: string | null = null;

  @Transform(vacioANulo)
  @IsOptional()
  @IsIn(['A', 'D', 'I'])
  estado: EstadoActivo | null = null;

  @Transform(numeroONulo)
  @IsOptional()
  @IsInt()
  cuenta: number | null = null;

  @Transform(numeroONulo)
  @IsOptional()
  @IsInt()
  relacion: number | null = null;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  limite = 500;
}

/**
 * Consultas (menú CONSULTAS de Java): solo lectura, para los 4 roles.
 * Buscador de activos, relación de cuentas, cuenta x activos y consulta de depreciaciones.
 */
@Controller('consultas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMINISTRADOR, Rol.OPERADOR, Rol.CONSULTAS, Rol.AUDITORIA)
export class ConsultasController {
  constructor(
    private readonly consultas: ConsultasRepository,
    private readonly activos: ActivosRepository,
  ) {}

  @Get('opciones')
  opciones() {
    return this.consultas.opciones();
  }

  /** Activos filtrados + totales de todo el filtro (aunque se devuelvan menos filas por el límite). */
  @Get('activos')
  async buscar(@Query() f: FiltroConsultaDto) {
    const [filas, totales] = await Promise.all([this.consultas.activos(f), this.consultas.totales(f)]);
    return { filas, totales, limite: f.limite };
  }

  @Get('activos/:id')
  async activo(@Param('id', ParseIntPipe) id: number) {
    const a = await this.activos.obtener(id);
    if (!a) throw new NotFoundException(`No existe el activo ${id}`);
    return a;
  }

  @Get('activos/:id/depreciacion')
  async depreciacion(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.activos.obtener(id))) throw new NotFoundException(`No existe el activo ${id}`);
    return this.activos.detalle(id);
  }
}
