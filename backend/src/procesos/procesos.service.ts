import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { codigoOracle } from '../database/database.service.js';
import { ProcesosRepository, type ActivoProceso, type CategoriaProceso } from './procesos.repository.js';

export interface VistaProceso {
  cuenta: number;
  periodo: { codigo: number; estado: string | null; fechaInicio: string; fechaFinal: string };
  totales: Record<CategoriaProceso, number> & { activos: number; terminan: number };
  /** Bloquea la ejecución: el procedimiento fallaría para toda la cuenta. */
  bloqueos: string[];
  /** Requieren confirmación explícita (el procedimiento no los trata bien). */
  advertencias: string[];
  activos: ActivoProceso[];
}

@Injectable()
export class ProcesosService {
  private readonly logger = new Logger(ProcesosService.name);

  constructor(
    private readonly repo: ProcesosRepository,
    private readonly bitacora: BitacoraService,
  ) {}

  resumen() {
    return this.repo.resumenCuentas();
  }

  /** Lo que haría DEP_GENERACION_MENSUAL, sin ejecutarlo. */
  async vista(cuenta: number, periodo: number): Promise<VistaProceso> {
    if (!(await this.repo.existeCuenta(cuenta))) throw new NotFoundException(`No existe la cuenta ${cuenta}`);
    const per = await this.repo.periodo(periodo);
    if (!per) throw new NotFoundException(`No existe el periodo ${periodo}`);

    const activos = await this.repo.vista(cuenta, periodo);
    const contar = (c: CategoriaProceso) => activos.filter((a) => a.categoria === c).length;
    const totales = {
      activos: activos.length,
      NORMAL: contar('NORMAL'),
      SALTO: contar('SALTO'),
      SIN_DETALLE: contar('SIN_DETALLE'),
      MENSUAL_CERO: contar('MENSUAL_CERO'),
      terminan: activos.filter((a) => a.ultimoMes).length,
    };

    const bloqueos: string[] = [];
    if (per.estado !== 'R') bloqueos.push(`El periodo ${periodo} no está en estado REGISTRADA`);
    if (totales.MENSUAL_CERO > 0) {
      const ids = activos.filter((a) => a.categoria === 'MENSUAL_CERO').map((a) => a.correlativo);
      bloqueos.push(
        `${ids.length} activo(s) con depreciación mensual 0 (${ids.join(', ')}) harían fallar el proceso de toda la cuenta. ` +
          'Corrija su valor original en la ficha del activo.',
      );
    }
    if (activos.length === 0) bloqueos.push('No hay activos pendientes de este periodo en la cuenta');

    const advertencias: string[] = [];
    if (totales.SALTO > 0) {
      const max = Math.max(...activos.filter((a) => a.categoria === 'SALTO').map((a) => a.mesesSalto));
      advertencias.push(
        `${totales.SALTO} activo(s) tienen meses sin generar antes de este periodo (hasta ${max} meses); ` +
          'el proceso registrará este mes como su siguiente mes y esos meses quedarán sin depreciar.',
      );
    }
    if (totales.SIN_DETALLE > 0) {
      advertencias.push(
        `${totales.SIN_DETALLE} activo(s) no tienen ninguna depreciación; comenzarán a depreciarse en este periodo ` +
          'aunque su fecha de inicio sea anterior.',
      );
    }

    return { cuenta, periodo: per, totales, bloqueos, advertencias, activos };
  }

  async generar(cuenta: number, periodo: number, aceptarAdvertencias: boolean, usuario: string) {
    const v = await this.vista(cuenta, periodo);
    if (v.bloqueos.length) throw new ConflictException(v.bloqueos.join(' '));
    if (v.advertencias.length && !aceptarAdvertencias) {
      throw new ConflictException(`Debe confirmar las advertencias antes de generar: ${v.advertencias.join(' ')}`);
    }

    const antes = await this.repo.conteo(cuenta, periodo);
    let clave: string;
    try {
      clave = await this.repo.generar(usuario, cuenta, periodo);
    } catch (err) {
      this.logger.error(`DEP_GENERACION_MENSUAL(${cuenta}, ${periodo}) falló: ${(err as Error).message}`);
      const ora = codigoOracle(err);
      throw new InternalServerErrorException(
        `No se pudo generar la depreciación${ora ? ` (ORA-${String(ora).padStart(5, '0')})` : ''}. No se guardó ningún cambio.`,
      );
    }
    if (clave !== '0') {
      this.logger.error(`DEP_GENERACION_MENSUAL(${cuenta}, ${periodo}) devolvió: ${clave}`);
      throw new InternalServerErrorException('No se pudo generar la depreciación. No se guardó ningún cambio.');
    }

    const despues = await this.repo.conteo(cuenta, periodo);
    const resultado = {
      mesesGenerados: despues.filas - antes.filas,
      activosTerminados: despues.depreciados - antes.depreciados,
      esperados: v.totales.activos,
    };
    this.bitacora.registrar(
      usuario,
      'ProcGenera',
      `Cuenta ${cuenta} periodo ${periodo}: ${resultado.mesesGenerados} meses generados, ${resultado.activosTerminados} activos terminados`,
    );
    return resultado;
  }

  /** El código AAAAMM debe ser un mes válido. */
  static validarPeriodo(periodo: number) {
    const mes = periodo % 100;
    if (periodo < 190001 || mes < 1 || mes > 12) throw new BadRequestException('Periodo no válido (AAAAMM)');
  }
}
