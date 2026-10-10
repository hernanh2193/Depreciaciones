import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, type RequestConUsuario } from '../auth/guards.js';
import { Rol, Roles } from '../auth/roles.js';
import { CatalogosService } from './catalogos.service.js';
import {
  CrearCuentaDto,
  CrearDivisionDto,
  CrearPeriodoDto,
  CrearRelacionDto,
  CrearSubCuentaDto,
} from './dto/catalogos.dto.js';

const { ADMINISTRADOR, OPERADOR, CONSULTAS } = Rol;

/**
 * Catálogos de cuentas y periodos.
 * Lectura: los roles que ven el menú en el sistema Java. Escritura: solo Administrador y Operador.
 */
@Controller('catalogos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get('cuentas')
  @Roles(ADMINISTRADOR, OPERADOR, CONSULTAS)
  listarCuentas() {
    return this.catalogos.listarCuentas();
  }

  @Post('cuentas')
  @Roles(ADMINISTRADOR, OPERADOR)
  @HttpCode(201)
  async crearCuenta(@Body() dto: CrearCuentaDto, @Req() req: RequestConUsuario) {
    await this.catalogos.crearCuenta(dto, req.user.sub);
  }

  @Get('subcuentas')
  @Roles(ADMINISTRADOR, OPERADOR, CONSULTAS)
  listarSubCuentas() {
    return this.catalogos.listarSubCuentas();
  }

  @Post('subcuentas')
  @Roles(ADMINISTRADOR, OPERADOR)
  @HttpCode(201)
  async crearSubCuenta(@Body() dto: CrearSubCuentaDto, @Req() req: RequestConUsuario) {
    await this.catalogos.crearSubCuenta(dto, req.user.sub);
  }

  @Get('divisiones')
  @Roles(ADMINISTRADOR, OPERADOR, CONSULTAS)
  listarDivisiones() {
    return this.catalogos.listarDivisiones();
  }

  @Post('divisiones')
  @Roles(ADMINISTRADOR, OPERADOR)
  @HttpCode(201)
  async crearDivision(@Body() dto: CrearDivisionDto, @Req() req: RequestConUsuario) {
    await this.catalogos.crearDivision(dto, req.user.sub);
  }

  @Get('relaciones')
  @Roles(ADMINISTRADOR, OPERADOR, CONSULTAS)
  listarRelaciones() {
    return this.catalogos.listarRelaciones();
  }

  @Get('relaciones/opciones')
  @Roles(ADMINISTRADOR, OPERADOR, CONSULTAS)
  opcionesRelacion() {
    return this.catalogos.opcionesRelacion();
  }

  @Post('relaciones')
  @Roles(ADMINISTRADOR, OPERADOR)
  @HttpCode(201)
  async crearRelacion(@Body() dto: CrearRelacionDto, @Req() req: RequestConUsuario) {
    await this.catalogos.crearRelacion(dto, req.user.sub);
  }

  @Get('periodos')
  @Roles(ADMINISTRADOR, OPERADOR)
  listarPeriodos() {
    return this.catalogos.listarPeriodos();
  }

  @Post('periodos')
  @Roles(ADMINISTRADOR, OPERADOR)
  @HttpCode(201)
  crearPeriodo(@Body() dto: CrearPeriodoDto, @Req() req: RequestConUsuario) {
    return this.catalogos.crearPeriodo(dto, req.user.sub);
  }
}
