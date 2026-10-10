import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { ActivosRepository, ErrorGeneracion } from './activos.repository.js';
import type { Activo, DatosActivo } from './activos.types.js';
import { factorMensual, primerDiaDelMes, valorMensual } from './calculo.js';
import type {
  ActualizarActivoDto,
  BuscarActivosDto,
  CrearActivoDto,
  CrearOtroPorcentajeDto,
} from './dto/activos.dto.js';

/** Copia a objeto plano solo los campos editables del activo. */
function datosDe(d: DatosActivo): DatosActivo {
  return {
    descripcion: d.descripcion,
    tarjeta: d.tarjeta,
    cuentaPresupuesto: d.cuentaPresupuesto,
    fechaInicio: d.fechaInicio,
    valorOriginal: d.valorOriginal,
    noConstancia: d.noConstancia,
    fechaConstancia: d.fechaConstancia,
    noCur: d.noCur,
    marca: d.marca,
    modelo: d.modelo,
    serie: d.serie,
    anio: d.anio,
  };
}

@Injectable()
export class ActivosService {
  private readonly logger = new Logger(ActivosService.name);

  constructor(
    private readonly repo: ActivosRepository,
    private readonly bitacora: BitacoraService,
  ) {}

  relaciones() {
    return this.repo.relaciones();
  }

  buscar(f: BuscarActivosDto) {
    return this.repo.buscar(f.texto, f.estado, f.limite);
  }

  async obtener(correlativo: number): Promise<Activo> {
    const a = await this.repo.obtener(correlativo);
    if (!a) throw new NotFoundException(`No existe el activo ${correlativo}`);
    return a;
  }

  async detalle(correlativo: number) {
    await this.obtener(correlativo);
    return this.repo.detalle(correlativo);
  }

  async otrosPorcentajes(correlativo: number) {
    await this.obtener(correlativo);
    return this.repo.otrosPorcentajes(correlativo);
  }

  /** Calcula factor y valor mensual siempre (en Java solo se calculaban si el usuario presionaba Enter). */
  async crear(dto: CrearActivoDto, usuario: string) {
    const porcentaje = await this.repo.porcentajeRelacion(dto.relacion);
    if (porcentaje === null) throw new BadRequestException('La relación de cuentas seleccionada no existe');
    const calculo = this.calcular(dto.valorOriginal, porcentaje);
    await this.validarPeriodo(dto.fechaInicio);

    try {
      const { correlativo } = await this.repo.crear({ ...datosDe(dto), relacion: dto.relacion, ...calculo }, usuario);
      this.bitacora.registrar(usuario, 'CatActivo', `Activo ${correlativo} registrado`);
      return { correlativo, ...calculo };
    } catch (err) {
      this.traducirErrorGeneracion(err, 'El activo no se guardó');
    }
  }

  /**
   * Actualiza los datos. Factor y valor mensual solo se recalculan si cambia el valor original
   * (o el factor guardado es 0), para no alterar activos con valores mensuales especiales.
   */
  async actualizar(correlativo: number, dto: ActualizarActivoDto, usuario: string) {
    const actual = await this.obtener(correlativo);
    const cambiaValor = dto.valorOriginal !== actual.valorOriginal;
    const calculo =
      cambiaValor || !actual.factor
        ? this.calcular(dto.valorOriginal, actual.porcentaje)
        : { factor: actual.factor, valorMensual: actual.valorMensual };

    await this.repo.actualizar(correlativo, { ...datosDe(dto), estado: dto.estado, ...calculo }, usuario);
    this.bitacora.registrar(usuario, 'CatActivoModifica', `Activo ${correlativo} actualizado`);

    // El detalle ya generado no cambia solo: avisar si conviene regenerarlo
    const regenerarSugerido =
      actual.mesesGenerados > 0 && (cambiaValor || dto.fechaInicio !== actual.fechaInicio || calculo.factor !== actual.factor);
    return { ...calculo, regenerarSugerido };
  }

  /** Borra el detalle y lo vuelve a generar con DEP_GENERACION_MES desde la fecha de inicio. */
  async regenerar(correlativo: number, usuario: string) {
    const a = await this.obtener(correlativo);
    if (a.estado === 'I') throw new ConflictException('El activo está ANULADO; cambie su estado antes de regenerar');
    if (a.tieneOtroPorcentaje) {
      throw new ConflictException(
        'Este activo tiene un tramo con otro porcentaje; regenere desde "Otros porcentajes" para no perderlo',
      );
    }
    if (!a.fechaInicio) throw new BadRequestException('El activo no tiene fecha de inicio');
    if (!a.valorMensual) throw new BadRequestException('El activo tiene valor mensual 0; actualice el valor original primero');
    await this.validarPeriodo(a.fechaInicio);

    try {
      await this.repo.regenerar(correlativo, 'dep_generacion_mes', a.fechaInicio, usuario);
    } catch (err) {
      this.traducirErrorGeneracion(err, 'El detalle anterior se conservó');
    }
    this.bitacora.registrar(usuario, 'CatActivoModifica', `Depreciación del activo ${correlativo} regenerada`);
    return this.obtener(correlativo);
  }

  async crearOtroPorcentaje(correlativo: number, dto: CrearOtroPorcentajeDto, usuario: string) {
    await this.obtener(correlativo);
    if (dto.fechaFinal < dto.fechaInicio) throw new BadRequestException('La fecha final no puede ser anterior a la inicial');
    if ((await this.repo.otrosPorcentajes(correlativo)).length > 0) {
      throw new ConflictException('El activo ya tiene un tramo con otro porcentaje');
    }
    await this.repo.insertarOtroPorcentaje(correlativo, dto);
    this.bitacora.registrar(usuario, 'CatActivoOtroPor', `Otro porcentaje registrado al activo ${correlativo}`);
  }

  /** Borra el detalle y lo regenera con DEP_GENERACION_PORCANT desde el inicio del tramo. */
  async regenerarConOtroPorcentaje(correlativo: number, usuario: string) {
    const a = await this.obtener(correlativo);
    if (a.estado === 'I') throw new ConflictException('El activo está ANULADO; cambie su estado antes de regenerar');
    const [tramo] = await this.repo.otrosPorcentajes(correlativo);
    if (!tramo?.fechaInicio) throw new BadRequestException('El activo no tiene un tramo con otro porcentaje');
    await this.validarPeriodo(tramo.fechaInicio);

    try {
      await this.repo.regenerar(correlativo, 'dep_generacion_porcant', tramo.fechaInicio, usuario);
    } catch (err) {
      this.traducirErrorGeneracion(err, 'El detalle anterior se conservó');
    }
    this.bitacora.registrar(usuario, 'CatActivoOtroPor', `Depreciación del activo ${correlativo} regenerada con otro porcentaje`);
    return this.obtener(correlativo);
  }

  private calcular(valorOriginal: number, porcentaje: number) {
    const factor = factorMensual(porcentaje);
    const mensual = valorMensual(valorOriginal, factor);
    if (mensual < 0.01) {
      throw new BadRequestException('Con ese valor original el valor mensual sería Q0.00; no se puede depreciar');
    }
    return { factor, valorMensual: mensual };
  }

  /** Los procedimientos buscan el periodo cuyo inicio es el día 1 del mes; si no existe, no generan nada. */
  private async validarPeriodo(fecha: string) {
    const primerDia = primerDiaDelMes(fecha);
    if (!(await this.repo.existePeriodoQueIniciaEl(primerDia))) {
      throw new BadRequestException(
        `No existe un periodo que inicie el ${primerDia.split('-').reverse().join('/')}. ` +
          'Revise el catálogo de periodos (el periodo puede no existir o tener fechas incorrectas).',
      );
    }
  }

  private traducirErrorGeneracion(err: unknown, consecuencia: string): never {
    if (err instanceof ErrorGeneracion) {
      this.logger.error(err.message);
      throw new InternalServerErrorException(`No se pudo generar la depreciación. ${consecuencia}.`);
    }
    throw err;
  }
}
