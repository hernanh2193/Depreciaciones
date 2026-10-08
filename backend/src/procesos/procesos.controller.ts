import { Body, Controller, Get, HttpCode, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { JwtAuthGuard, RolesGuard, type RequestConUsuario } from '../auth/guards.js';
import { Rol, Roles } from '../auth/roles.js';
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

/** "Generar depreciación" (ProcGenera.zul): solo Administrador y Operador. */
@Controller('procesos/depreciacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMINISTRADOR, Rol.OPERADOR)
export class ProcesosController {
  constructor(private readonly procesos: ProcesosService) {}

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
}
