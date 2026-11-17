import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard, RolesGuard, type RequestConUsuario } from '../auth/guards.js';
import { Rol, Roles } from '../auth/roles.js';
import { UsuariosService } from './usuarios.service.js';

const textoONulo = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() ? value.trim() : null);

// Antes del controlador: los decoradores leen el tipo al definir la clase.
export class DatosUsuarioDto {
  @IsIn(['1', '2', '3', '4'], { message: 'Rol no válido' })
  rol: string;

  @IsIn(['A', 'I'], { message: 'Estado no válido' })
  estado: 'A' | 'I';

  /** DEP_USUARIOS.USU_CORREO es VARCHAR2(40) (Java permitía 80 y el guardado fallaba). */
  @Transform(textoONulo)
  @IsOptional()
  @IsEmail({}, { message: 'Correo no válido' })
  @MaxLength(40, { message: 'El correo admite máximo 40 caracteres' })
  correo: string | null = null;

  @Transform(textoONulo)
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'La observación admite máximo 100 caracteres' })
  observacion: string | null = null;
}

export class CrearUsuarioDto extends DatosUsuarioDto {
  /** Código de empleado (USU_CODIGO NUMBER(5)). */
  @IsInt({ message: 'Código de empleado no válido' })
  @Min(1)
  @Max(99999)
  codigo: number;
}

/** Administración de usuarios: solo Administrador (en Java el menú ADMINISTRAR solo lo veía el rol 1). */
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMINISTRADOR)
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar() {
    return this.usuarios.listar();
  }

  @Get('empleado/:codigo')
  empleado(@Param('codigo', ParseIntPipe) codigo: number) {
    return this.usuarios.empleado(codigo);
  }

  @Get(':codigo')
  obtener(@Param('codigo', ParseIntPipe) codigo: number) {
    return this.usuarios.obtener(codigo);
  }

  @Post()
  @HttpCode(201)
  crear(@Body() dto: CrearUsuarioDto, @Req() req: RequestConUsuario) {
    const { codigo, ...datos } = dto;
    return this.usuarios.crear(codigo, datos, req.user.sub);
  }

  @Put(':codigo')
  @HttpCode(204)
  async actualizar(@Param('codigo', ParseIntPipe) codigo: number, @Body() dto: DatosUsuarioDto, @Req() req: RequestConUsuario) {
    await this.usuarios.actualizar(codigo, { rol: dto.rol, estado: dto.estado, correo: dto.correo, observacion: dto.observacion }, req.user.sub);
  }

  @Post(':codigo/restablecer-clave')
  @HttpCode(200)
  restablecerClave(@Param('codigo', ParseIntPipe) codigo: number, @Req() req: RequestConUsuario) {
    return this.usuarios.restablecerClave(codigo, req.user.sub);
  }
}
