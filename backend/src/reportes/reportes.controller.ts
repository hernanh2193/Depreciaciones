import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard, RolesGuard, type RequestConUsuario } from '../auth/guards.js';
import { Rol, Roles } from '../auth/roles.js';
import { ReportesService, type ArchivoPdf } from './reportes.service.js';

const entero = ({ value }: { value: unknown }) => (value === '' || value === undefined || value === null ? undefined : Number(value));

// Antes del controlador: los decoradores leen el tipo al definir la clase.
export class ParametrosReporteDto {
  @Transform(entero)
  @IsOptional()
  @IsInt({ message: 'Año no válido' })
  anio?: number;

  @Transform(entero)
  @IsOptional()
  @IsInt({ message: 'Mes no válido' })
  mes?: number;

  @Transform(entero)
  @IsOptional()
  @IsInt({ message: 'Cuenta no válida' })
  cuenta?: number;

  @Transform(entero)
  @IsOptional()
  @IsInt({ message: 'Relación no válida' })
  relacion?: number;

  @Transform(entero)
  @IsOptional()
  @IsInt({ message: 'Número de activo no válido' })
  activo?: number;
}

/** Reportes PDF (menú REPORTES de Java): solo lectura, para los 4 roles. */
@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMINISTRADOR, Rol.OPERADOR, Rol.CONSULTAS, Rol.AUDITORIA)
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('opciones')
  opciones() {
    return this.reportes.opciones();
  }

  /** Devuelve el PDF para mostrarlo en el navegador (inline). */
  @Get(':clave')
  async generar(
    @Param('clave') clave: string,
    @Query() p: ParametrosReporteDto,
    @Req() req: RequestConUsuario,
    @Res() res: Response,
  ) {
    const u = req.user.sub;
    const requerido = (v: number | undefined, nombre: string) => {
      if (v === undefined) throw new BadRequestException(`Falta el parámetro ${nombre}`);
      return v;
    };
    let archivo: ArchivoPdf;
    switch (clave) {
      case 'catalogo-cuentas':
        archivo = await this.reportes.catalogoCuentas(u);
        break;
      case 'relacion-cuentas':
        archivo = await this.reportes.relacionCuentas(requerido(p.relacion, 'relación'), u);
        break;
      case 'depreciacion-activo':
        archivo = await this.reportes.tarjetaActivo(requerido(p.activo, 'activo'), u);
        break;
      case 'activos-por-cuenta':
        archivo = await this.reportes.activosPorCuenta(requerido(p.cuenta, 'cuenta'), u);
        break;
      case 'acumulado-mensual':
        archivo = await this.reportes.acumuladoMensual(requerido(p.anio, 'año'), requerido(p.mes, 'mes'), u);
        break;
      case 'resumen-cuenta':
        archivo = await this.reportes.resumenPorCuenta(requerido(p.anio, 'año'), requerido(p.mes, 'mes'), requerido(p.cuenta, 'cuenta'), u);
        break;
      case 'resumen-mensual':
        archivo = await this.reportes.resumenMensual(requerido(p.anio, 'año'), requerido(p.mes, 'mes'), u);
        break;
      case 'consolidacion':
        archivo = await this.reportes.consolidacionAnual(requerido(p.relacion, 'relación'), requerido(p.anio, 'año'), u);
        break;
      default:
        throw new NotFoundException(`No existe el reporte ${clave}`);
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${archivo.nombre}"`,
      'Content-Length': String(archivo.contenido.length),
      'Cache-Control': 'no-store',
    });
    res.end(archivo.contenido);
  }
}
