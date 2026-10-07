import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, type RequestConUsuario } from '../auth/guards.js';
import { Rol, Roles } from '../auth/roles.js';
import { ActivosService } from './activos.service.js';
import {
  ActualizarActivoDto,
  BuscarActivosDto,
  CrearActivoDto,
  CrearOtroPorcentajeDto,
} from './dto/activos.dto.js';

/** Registro y mantenimiento de activos. Solo Administrador y Operador, como en el menú Java. */
@Controller('activos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMINISTRADOR, Rol.OPERADOR)
export class ActivosController {
  constructor(private readonly activos: ActivosService) {}

  @Get('relaciones')
  relaciones() {
    return this.activos.relaciones();
  }

  @Get()
  buscar(@Query() filtro: BuscarActivosDto) {
    return this.activos.buscar(filtro);
  }

  @Post()
  @HttpCode(201)
  crear(@Body() dto: CrearActivoDto, @Req() req: RequestConUsuario) {
    return this.activos.crear(dto, req.user.sub);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.activos.obtener(id);
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarActivoDto, @Req() req: RequestConUsuario) {
    return this.activos.actualizar(id, dto, req.user.sub);
  }

  @Get(':id/detalle')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.activos.detalle(id);
  }

  @Post(':id/regenerar')
  @HttpCode(200)
  regenerar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestConUsuario) {
    return this.activos.regenerar(id, req.user.sub);
  }

  @Get(':id/otros-porcentajes')
  otrosPorcentajes(@Param('id', ParseIntPipe) id: number) {
    return this.activos.otrosPorcentajes(id);
  }

  @Post(':id/otros-porcentajes')
  @HttpCode(201)
  async crearOtroPorcentaje(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearOtroPorcentajeDto,
    @Req() req: RequestConUsuario,
  ) {
    await this.activos.crearOtroPorcentaje(id, dto, req.user.sub);
  }

  @Post(':id/otros-porcentajes/regenerar')
  @HttpCode(200)
  regenerarConOtroPorcentaje(@Param('id', ParseIntPipe) id: number, @Req() req: RequestConUsuario) {
    return this.activos.regenerarConOtroPorcentaje(id, req.user.sub);
  }
}
