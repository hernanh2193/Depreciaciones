import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { codigoOracle, ORA_PADRE_NO_EXISTE, ORA_REGISTRO_DUPLICADO } from '../database/database.service.js';
import { CatalogosRepository } from './catalogos.repository.js';
import type { Periodo } from './catalogos.types.js';
import type {
  CrearCuentaDto,
  CrearDivisionDto,
  CrearPeriodoDto,
  CrearRelacionDto,
  CrearSubCuentaDto,
} from './dto/catalogos.dto.js';

/** Calcula código AAAAMM, primer y último día a partir de "YYYY-MM". */
export function periodoDesdeMes(mes: string): Pick<Periodo, 'codigo' | 'fechaInicio' | 'fechaFinal'> {
  const [anio, m] = mes.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return {
    codigo: anio * 100 + m,
    fechaInicio: `${anio}-${mm}-01`,
    fechaFinal: `${anio}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

@Injectable()
export class CatalogosService {
  private readonly logger = new Logger(CatalogosService.name);

  constructor(
    private readonly repo: CatalogosRepository,
    private readonly bitacora: BitacoraService,
  ) {}

  listarCuentas() {
    return this.repo.listarCuentas();
  }

  async crearCuenta(dto: CrearCuentaDto, usuario: string) {
    try {
      await this.repo.insertarCuenta(dto, usuario);
    } catch (err) {
      this.traducirError(err, { duplicado: `Ya existe una cuenta con el código ${dto.codigo}` });
    }
    this.bitacora.registrar(usuario, 'CatCuenta', `Cuenta ${dto.codigo} creada`);
  }

  listarSubCuentas() {
    return this.repo.listarSubCuentas();
  }

  async crearSubCuenta(dto: CrearSubCuentaDto, usuario: string) {
    const clave = await this.repo.insertarSubCuenta(dto.codigo, dto.descripcion, dto.porcentaje, usuario);
    this.validarClaveProcedimiento(clave, 'la subcuenta');
    this.bitacora.registrar(usuario, 'CatSubCuenta', `Subcuenta ${dto.codigo} creada`);
  }

  listarDivisiones() {
    return this.repo.listarDivisiones();
  }

  async crearDivision(dto: CrearDivisionDto, usuario: string) {
    const clave = await this.repo.insertarDivision(dto.codigo, dto.descripcion, dto.porcentaje, usuario);
    this.validarClaveProcedimiento(clave, 'la división');
    this.bitacora.registrar(usuario, 'CatDivCuenta', `División ${dto.codigo} creada`);
  }

  listarRelaciones() {
    return this.repo.listarRelaciones();
  }

  async opcionesRelacion() {
    const [cuentas, subCuentas, divisiones] = await Promise.all([
      this.repo.opcionesCuenta(),
      this.repo.opcionesSubCuenta(),
      this.repo.opcionesDivision(),
    ]);
    return { cuentas, subCuentas, divisiones };
  }

  async crearRelacion(dto: CrearRelacionDto, usuario: string) {
    const division = dto.division ?? null;
    if (await this.repo.existeRelacion(dto.cuenta, dto.subCuenta, division)) {
      throw new ConflictException('Esa combinación de cuenta, subcuenta y división ya existe');
    }
    const clave = await this.repo.insertarRelacion(dto.cuenta, dto.subCuenta, division, usuario);
    this.validarClaveProcedimiento(clave, 'la relación', 'La cuenta, subcuenta o división seleccionada no existe');
    this.bitacora.registrar(usuario, 'CatRelCuenta', `Relación ${dto.cuenta}/${dto.subCuenta}/${division ?? '-'} creada`);
  }

  listarPeriodos() {
    return this.repo.listarPeriodos();
  }

  async crearPeriodo(dto: CrearPeriodoDto, usuario: string) {
    const datos = periodoDesdeMes(dto.mes);
    try {
      await this.repo.insertarPeriodo({ ...datos, estado: dto.estado }, usuario);
    } catch (err) {
      this.traducirError(err, { duplicado: `El periodo ${datos.codigo} ya existe` });
    }
    this.bitacora.registrar(usuario, 'CatPeriodo', `Periodo ${datos.codigo} creado`);
    return datos;
  }

  /** Los procedimientos DEP_INSERTA_* devuelven '0' si todo salió bien o un texto con el error ORA. */
  private validarClaveProcedimiento(clave: string, que: string, padreNoExiste?: string) {
    if (clave === '0') return;
    const ora = codigoOracle(clave);
    this.logger.error(`Error al insertar ${que}: ${clave}`);
    if (ora === ORA_PADRE_NO_EXISTE && padreNoExiste) throw new BadRequestException(padreNoExiste);
    if (ora === ORA_REGISTRO_DUPLICADO) throw new ConflictException(`No se pudo guardar ${que}: registro duplicado`);
    throw new InternalServerErrorException(`No se pudo guardar ${que}`);
  }

  private traducirError(err: unknown, mensajes: { duplicado: string }): never {
    if (codigoOracle(err) === ORA_REGISTRO_DUPLICADO) throw new ConflictException(mensajes.duplicado);
    throw err;
  }
}
