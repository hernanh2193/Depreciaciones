import { Body, Controller, Get, HttpCode, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { JwtAuthGuard, RolesGuard, type RequestConUsuario } from '../auth/guards.js';
import { Rol, Roles } from '../auth/roles.js';
import { PonerAlDiaService } from './poner-al-dia.service.js';
import { ProcesosService } from './procesos.service.js';

export class GenerarDto {
  @IsInt({ message: 'Debe seleccionar la cuenta' })
  cuenta: number;

  @IsInt({ message: 'Debe indicar el periodo (AAAAMM)' })
  periodo: number;

  @IsOptional()
  @IsBoolean()
  aceptarAdvertencias = false;
}

// Debe declararse antes del controlador: los decoradores leen el tipo al definir la clase.
export class PonerAlDiaDto {
  @IsInt({ message: 'Debe seleccionar la cuenta' })
  cuenta: number;
}

/** "Generar depreciación" (ProcGenera.zul): solo Administrador y Operador. */
@Controller('procesos/depreciacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMINISTRADOR, Rol.OPERADOR)
export class ProcesosController {
  constructor(
    private readonly procesos: ProcesosService,
    private readonly ponerAlDia: PonerAlDiaService,
  ) {}

  @Get('resumen')
  resumen() {
    return this.procesos.resumen();
  }

  @Get('vista')
  vista(@Query('cuenta', ParseIntPipe) cuenta: number, @Query('periodo', ParseIntPipe) periodo: number) {
    ProcesosService.validarPeriodo(periodo);
    return this.procesos.vista(cuenta, periodo);
  }

  @Post('generar')
  @HttpCode(200)
  generar(@Body() dto: GenerarDto, @Req() req: RequestConUsuario) {
    ProcesosService.validarPeriodo(dto.periodo);
    return this.procesos.generar(dto.cuenta, dto.periodo, dto.aceptarAdvertencias, req.user.sub);
  }

  /** Qué haría "Poner al día" con la cuenta (sin ejecutar). */
  @Get('poner-al-dia/vista')
  vistaPonerAlDia(@Query('cuenta', ParseIntPipe) cuenta: number) {
    return this.ponerAlDia.vista(cuenta);
  }

  /** Inicia "Poner al día" en segundo plano; el avance se consulta con GET poner-al-dia/estado. */
  @Post('poner-al-dia')
  @HttpCode(202)
  iniciarPonerAlDia(@Body() dto: PonerAlDiaDto, @Req() req: RequestConUsuario) {
    return this.ponerAlDia.iniciar(dto.cuenta, req.user.sub);
  }

  @Get('poner-al-dia/estado')
  estadoPonerAlDia() {
    return this.ponerAlDia.estado() ?? {};
  }
}
