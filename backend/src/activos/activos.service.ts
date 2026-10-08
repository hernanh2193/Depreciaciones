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
  TrasladarActivoDto,
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
  async crear(dto: CrearActivoDto, usuario: string, hoy = new Date()) {
    const porcentaje = await this.repo.porcentajeRelacion(dto.relacion);
    if (porcentaje === null) throw new BadRequestException('La relación de cuentas seleccionada no existe');
    const calculo = this.calcular(dto.valorOriginal, porcentaje);
    const ajuste = dto.mesProcesoAjuste
      ? await this.validarAjuste(dto.fechaInicio, dto.mesProcesoAjuste, dto.valorOriginal, calculo.valorMensual, hoy)
      : null;
    if (!ajuste) await this.validarPeriodo(dto.fechaInicio);

    let correlativo: number;
    try {
      ({ correlativo } = await this.repo.crear(
        { ...datosDe(dto), relacion: dto.relacion, ...calculo },
        usuario,
        dto.mesProcesoAjuste ?? null,
      ));
    } catch (err) {
      this.traducirErrorGeneracion(err, 'El activo no se guardó');
    }

    if (ajuste) {
      // AJUSTE2 ignora los errores de AJUSTE3 y devuelve '0' aunque AJUSTE3 haya hecho ROLLBACK: verificar.
      const guardado = await this.repo.obtener(correlativo);
      if (!guardado || guardado.mesesGenerados === 0) {
        this.logger.error(`Ajuste del activo ${correlativo}: el procedimiento respondió OK pero no dejó datos`);
        throw new InternalServerErrorException(
          'El procedimiento de ajuste no generó la depreciación. Verifique los periodos y vuelva a intentarlo.',
        );
      }
      this.bitacora.registrar(usuario, 'CatActivo', `Activo ${correlativo} registrado con ajuste de ${ajuste.meses} meses`);
      return { correlativo, ...calculo, ajuste: { ...ajuste, mesesGenerados: guardado.mesesGenerados } };
    }
    this.bitacora.registrar(usuario, 'CatActivo', `Activo ${correlativo} registrado`);
    return { correlativo, ...calculo };
  }

  /**
   * Reglas de DEP_GENERACION_DEPRE_AJUSTE2:
   * - meses = ROUND(MONTHS_BETWEEN(LAST_DAY(proceso), ADD_MONTHS(inicio, 1))) = meses del siguiente al de inicio hasta el de proceso
   * - si meses <= 0 no inserta nada y aun así responde OK
   * - el periodo del mes de proceso se busca por su FECHA FINAL (debe haber exactamente uno) y AJUSTE3 continúa
   *   desde el periodo que inicia el día 1 de ese mes
   */
  private async validarAjuste(fechaInicio: string, mesProceso: string, valorOriginal: number, mensual: number, hoy: Date) {
    const indice = (anioMes: string) => Number(anioMes.slice(0, 4)) * 12 + Number(anioMes.slice(5, 7));
    const meses = indice(mesProceso) - indice(fechaInicio);
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

    if (meses < 1) throw new BadRequestException('El mes de proceso del ajuste debe ser posterior al mes de inicio');
    if (mesProceso > mesActual) throw new BadRequestException('El mes de proceso del ajuste no puede ser futuro');
    const monto = Math.round(meses * mensual * 100) / 100;
    if (monto > valorOriginal - 1) {
      throw new BadRequestException(
        `El ajuste de ${meses} meses (Q${monto.toFixed(2)}) supera el valor depreciable; el activo ya estaría totalmente depreciado`,
      );
    }
    const p = await this.repo.periodosDelMesDeProceso(mesProceso);
    if (p.porFechaFinal !== 1 || p.queIniciaElDia1 !== 1) {
      throw new BadRequestException(
        `El periodo de ${mesProceso.split('-').reverse().join('/')} no existe o tiene fechas incorrectas; revise el catálogo de periodos`,
      );
    }
    return { meses, monto, mesProceso };
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

  // ---------------- Traslado ----------------

  async empleado(codigo: number) {
    const e = await this.repo.empleado(codigo);
    if (!e) throw new NotFoundException(`No existe el empleado ${codigo}`);
    return e;
  }

  async documentosTraslado(correlativo: number) {
    await this.obtener(correlativo);
    return this.repo.documentosTraslado(correlativo);
  }

  /**
   * Vista previa con las mismas fórmulas de DEP_GENERACION_TRASLADO (lo que hacía el botón "Calcular" en Java):
   * factor = ROUND(pct/100/12, 6), mensual = ROUND((valor-1)*factor, 2), meses = meses generados + 1.
   */
  async vistaTraslado(correlativo: number, relacion: number) {
    const a = await this.obtener(correlativo);
    const { info, porcentaje } = await this.validarTraslado(a, relacion);
    const factor = Math.round((porcentaje / 100 / 12) * 1e6) / 1e6;
    const mensual = valorMensual(a.valorOriginal, factor);
    const meses = info.mesesGenerados + 1;
    const acumulada = Math.round(mensual * meses * 100) / 100;
    return {
      porcentaje,
      factor,
      valorMensual: mensual,
      meses,
      depreciacionAcumulada: acumulada,
      valorLibros: Math.round((a.valorOriginal - acumulada) * 100) / 100,
      periodo: info.siguientePeriodo,
    };
  }

  async trasladar(correlativo: number, dto: TrasladarActivoDto, usuario: string) {
    const a = await this.obtener(correlativo);
    await this.validarTraslado(a, dto.relacion);
    if (!(await this.repo.empleado(dto.autoriza))) {
      throw new BadRequestException(`No existe el empleado ${dto.autoriza} que autoriza`);
    }

    let nuevo: number | null;
    try {
      nuevo = await this.repo.trasladar(correlativo, dto.relacion, dto, usuario);
    } catch (err) {
      this.traducirErrorGeneracion(err, 'No se realizó ningún cambio');
    }
    if (!nuevo) {
      throw new InternalServerErrorException('El procedimiento de traslado respondió OK pero no creó el activo nuevo');
    }
    this.bitacora.registrar(usuario, 'CatActivoTraslado', `Activo ${correlativo} trasladado al ${nuevo}`);
    return { activoNuevo: nuevo };
  }

  /** DEP_GENERACION_TRASLADO no hace nada (y responde OK) si el activo no está en estado A, y falla sin detalle. */
  private async validarTraslado(a: Activo, relacion: number) {
    if (a.estado !== 'A') {
      throw new ConflictException(
        a.trasladadoA ? `El activo ya fue trasladado al No. ${a.trasladadoA}` : 'Solo se pueden trasladar activos en estado ACTIVO',
      );
    }
    if (relacion === a.relacionCodigo) throw new BadRequestException('Seleccione una relación de cuentas distinta a la actual');
    const porcentaje = await this.repo.porcentajeRelacion(relacion);
    if (porcentaje === null) throw new BadRequestException('La relación de cuentas destino no existe');
    const info = await this.repo.infoTraslado(a.correlativo);
    if (info.mesesGenerados === 0) {
      throw new ConflictException('El activo no tiene depreciación generada; regenere su depreciación antes de trasladarlo');
    }
    if (!info.siguientePeriodo) {
      throw new BadRequestException(`No existe el periodo siguiente a ${info.ultimoPeriodo}; regístrelo en el catálogo de periodos`);
    }
    return { info, porcentaje };
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
