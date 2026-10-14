import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { ProcesosRepository, type ActivoAtrasado } from './procesos.repository.js';

export interface VistaPonerAlDia {
  cuenta: number;
  periodoActual: number;
  /** Sin ningún detalle: se generan completos desde su inicio con DEP_GENERACION_MES. */
  sinDetalle: ActivoAtrasado[];
  /** Con meses faltantes: se completan mes a mes con DEP_GENERACION_MENSUAL en orden. */
  atrasados: ActivoAtrasado[];
  /** Periodos que se procesarán con DEP_GENERACION_MENSUAL, en orden. */
  periodos: number[];
  mesesEstimados: number;
  bloqueos: string[];
}

export interface EstadoTrabajo {
  cuenta: number;
  usuario: string;
  inicio: string;
  fin: string | null;
  fase: 'sin-detalle' | 'mensual' | 'terminado' | 'error';
  avance: number;
  total: number;
  detalle: string;
  activosCompletados: number;
  periodosProcesados: number;
  errores: string[];
}

/**
 * "Poner al día" una cuenta: deja a cada activo en estado A con todos sus meses generados hasta el periodo vigente.
 *  1. Activos sin detalle: DEP_GENERACION_MES desde su fecha de inicio (como al registrarlos).
 *  2. Activos con meses faltantes: DEP_GENERACION_MENSUAL periodo por periodo, en orden. El procedimiento solo
 *     incluye a un activo cuando el periodo es justo el siguiente a su último mes, así que cada uno recibe sus
 *     meses consecutivos sin saltos.
 * Cada llamada a un procedimiento hace su propio COMMIT: si se interrumpe, volver a ejecutar continúa donde quedó.
 */
@Injectable()
export class PonerAlDiaService {
  private readonly logger = new Logger(PonerAlDiaService.name);
  private trabajo: EstadoTrabajo | null = null;

  constructor(
    private readonly repo: ProcesosRepository,
    private readonly bitacora: BitacoraService,
  ) {}

  estado(): EstadoTrabajo | null {
    return this.trabajo;
  }

  async vista(cuenta: number): Promise<VistaPonerAlDia> {
    if (!(await this.repo.existeCuenta(cuenta))) throw new NotFoundException(`No existe la cuenta ${cuenta}`);
    const actual = await this.repo.periodoActual();
    if (!actual) throw new ConflictException('No hay un periodo vigente para la fecha de hoy; revise el catálogo de periodos');

    const activos = await this.repo.atrasados(cuenta, actual);
    const sinDetalle = activos.filter((a) => a.ultimoPeriodo === null);
    const atrasados = activos.filter((a) => a.ultimoPeriodo !== null);

    const bloqueos: string[] = [];
    const cero = activos.filter((a) => !a.valorMensual);
    if (cero.length) {
      bloqueos.push(
        `${cero.length} activo(s) con depreciación mensual 0 (${cero.map((a) => a.correlativo).join(', ')}) harían fallar ` +
          'el procedimiento de toda la cuenta. Corrija su valor en la ficha del activo (Guardar recalcula la depreciación mensual).',
      );
    }
    const sinPeriodo = sinDetalle.filter((a) => a.valorMensual && !a.tienePeriodoInicio);
    if (sinPeriodo.length) {
      bloqueos.push(
        `${sinPeriodo.length} activo(s) sin detalle no tienen el periodo de su mes de inicio ` +
          `(${sinPeriodo.map((a) => `${a.correlativo}: ${a.fechaInicio}`).join(', ')}); regístrelo en el catálogo de periodos.`,
      );
    }

    const desde = Math.min(...atrasados.map((a) => a.ultimoPeriodo as number));
    const periodos = atrasados.length ? await this.repo.periodosEntre(desde, actual) : [];
    const mesesEstimados =
      atrasados.reduce((s, a) => s + (a.mesesFaltantes ?? 0), 0) +
      sinDetalle.reduce((s, a) => s + mesesDesde(a.fechaInicio, actual), 0);

    return { cuenta, periodoActual: actual, sinDetalle, atrasados, periodos, mesesEstimados, bloqueos };
  }

  /** Inicia el trabajo en segundo plano y responde de inmediato. */
  async iniciar(cuenta: number, usuario: string): Promise<EstadoTrabajo> {
    if (this.trabajo && !this.trabajo.fin) {
      throw new ConflictException(`Ya hay un proceso en curso (cuenta ${this.trabajo.cuenta}, iniciado por ${this.trabajo.usuario})`);
    }
    const v = await this.vista(cuenta);
    if (v.bloqueos.length) throw new ConflictException(v.bloqueos.join(' '));
    if (!v.sinDetalle.length && !v.periodos.length) throw new ConflictException('La cuenta ya está al día');

    this.trabajo = {
      cuenta,
      usuario,
      inicio: new Date().toISOString(),
      fin: null,
      fase: 'sin-detalle',
      avance: 0,
      total: v.sinDetalle.length + v.periodos.length,
      detalle: '',
      activosCompletados: 0,
      periodosProcesados: 0,
      errores: [],
    };
    void this.ejecutar(v, usuario, this.trabajo);
    return this.trabajo;
  }

  private async ejecutar(v: VistaPonerAlDia, usuario: string, t: EstadoTrabajo) {
    try {
      // 1. Activos sin detalle: completos desde su inicio
      for (const a of v.sinDetalle) {
        t.detalle = `Activo ${a.correlativo} desde ${a.fechaInicio}`;
        const clave = await this.repo.generarDesdeInicio(usuario, a.correlativo, a.fechaInicio as string);
        if (clave === '0') t.activosCompletados++;
        else t.errores.push(`Activo ${a.correlativo}: ${clave}`);
        t.avance++;
      }

      // Si alguno quedó sin detalle, el paso 2 lo haría empezar tarde: detener.
      const quedan = (await this.repo.atrasados(v.cuenta, v.periodoActual)).filter((a) => a.ultimoPeriodo === null);
      if (quedan.length) {
        throw new Error(
          `${quedan.length} activo(s) siguen sin depreciación (${quedan.map((a) => a.correlativo).join(', ')}); ` +
            'no se procesaron los meses faltantes para no generarlos desde una fecha equivocada',
        );
      }

      // 2. Meses faltantes, periodo por periodo en orden
      t.fase = 'mensual';
      for (const periodo of v.periodos) {
        t.detalle = `Periodo ${periodo}`;
        const clave = await this.repo.generar(usuario, v.cuenta, periodo);
        if (clave !== '0') throw new Error(`Periodo ${periodo}: ${clave}`);
        t.periodosProcesados++;
        t.avance++;
      }
      t.fase = 'terminado';
      t.detalle = 'Cuenta al día';
    } catch (err) {
      t.fase = 'error';
      t.errores.push((err as Error).message);
      this.logger.error(`Poner al día cuenta ${v.cuenta}: ${(err as Error).message}`);
    } finally {
      t.fin = new Date().toISOString();
      this.bitacora.registrar(
        usuario,
        'ProcGenera',
        `Poner al día cuenta ${v.cuenta}: ${t.activosCompletados} activos sin detalle generados, ` +
          `${t.periodosProcesados} periodos procesados, ${t.errores.length} errores`,
      );
    }
  }
}

/** Meses desde el siguiente al de inicio hasta el periodo vigente (lo que generará DEP_GENERACION_MES). */
function mesesDesde(fechaInicio: string | null, actual: number): number {
  if (!fechaInicio) return 0;
  const inicio = Number(fechaInicio.slice(0, 4)) * 12 + Number(fechaInicio.slice(5, 7));
  const fin = Math.floor(actual / 100) * 12 + (actual % 100);
  return Math.max(fin - inicio, 0);
}
