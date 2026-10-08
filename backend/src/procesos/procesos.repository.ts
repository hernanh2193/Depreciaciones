import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service.js';

/**
 * Cómo trataría DEP_GENERACION_MENSUAL a cada activo de la cuenta:
 * - NORMAL: su último mes generado es el periodo anterior; se agrega el mes en orden.
 * - SALTO: le faltan meses entre su último mes y el periodo; el procedimiento los salta sin avisar.
 * - SIN_DETALLE: nunca se ha depreciado; empieza en este periodo aunque haya iniciado antes.
 * - MENSUAL_CERO: valor mensual 0; el procedimiento falla (división entre cero) y revierte TODA la cuenta.
 */
export type CategoriaProceso = 'NORMAL' | 'SALTO' | 'SIN_DETALLE' | 'MENSUAL_CERO';

export interface ActivoProceso {
  correlativo: number;
  descripcion: string;
  fechaInicio: string | null;
  valorOriginal: number;
  valorMensual: number;
  ultimoPeriodo: number | null;
  mesesGenerados: number;
  mesesSalto: number;
  /** Con este mes llega al final de su vida útil y el procedimiento lo marca como D. */
  ultimoMes: boolean;
  categoria: CategoriaProceso;
}

export interface ResumenCuenta {
  cuenta: number;
  descripcion: string;
  activos: number;
  ultimoPeriodo: number | null;
  siguientePeriodo: number | null;
}

export interface PeriodoProceso {
  codigo: number;
  estado: string | null;
  fechaInicio: string;
  fechaFinal: string;
}

/**
 * Selección idéntica al cursor P_CUENTAD de DEP_GENERACION_MENSUAL (activos A de la cuenta, que iniciaron antes
 * del periodo y sin detalle en el periodo o posteriores) más la clasificación de cada activo.
 */
const SQL_VISTA = `
WITH p AS (SELECT per_correlativo FROM depreciaciones.dep_per_periodo WHERE per_codper = :periodo),
     base AS (
       SELECT e.crtl_correlativo id, SUBSTR(e.crtl_descripcion, 1, 200) descripcion,
              TO_CHAR(e.crtl_fecha_inicio, 'YYYY-MM-DD') inicio, e.crtl_valor_original valor, e.crtl_valor_mensual mensual,
              (SELECT MAX(d.det_codper) FROM depreciaciones.dep_detctrl_depreciacion d WHERE d.det_codcrtl = e.crtl_correlativo) ultimo,
              (SELECT NVL(MAX(d.det_correlativo), 0) FROM depreciaciones.dep_detctrl_depreciacion d WHERE d.det_codcrtl = e.crtl_correlativo) meses_gen
         FROM depreciaciones.dep_control_depreciacion e
         JOIN depreciaciones.dep_detrel_cuentas a ON a.rel_codigo = e.crtl_codrel_cta
        WHERE e.crtl_estado = 'A'
          AND a.rel_codcta = :cuenta
          AND TO_CHAR(e.crtl_fecha_inicio, 'RRRRMM') < :periodo
          AND NOT EXISTS (SELECT 1 FROM depreciaciones.dep_detctrl_depreciacion f
                           WHERE f.det_codcrtl = e.crtl_correlativo
                             AND f.det_codper BETWEEN :periodo AND (SELECT MAX(per_codper) FROM depreciaciones.dep_per_periodo)))
SELECT b.id "correlativo", b.descripcion "descripcion", b.inicio "fechaInicio", b.valor "valorOriginal",
       b.mensual "valorMensual", b.ultimo "ultimoPeriodo", b.meses_gen "mesesGenerados",
       CASE WHEN b.ultimo IS NULL OR NVL(b.mensual, 0) = 0 THEN 0
            ELSE GREATEST((SELECT per_correlativo FROM p) - pu.per_correlativo - 1, 0) END "mesesSalto",
       CASE WHEN NVL(b.mensual, 0) > 0 AND b.meses_gen >= ROUND(b.valor / b.mensual) - 1 THEN 1 ELSE 0 END "ultimoMes",
       CASE WHEN NVL(b.mensual, 0) = 0 THEN 'MENSUAL_CERO'
            WHEN b.ultimo IS NULL THEN 'SIN_DETALLE'
            WHEN pu.per_correlativo = (SELECT per_correlativo FROM p) - 1 THEN 'NORMAL'
            ELSE 'SALTO' END "categoria"
  FROM base b
  LEFT JOIN depreciaciones.dep_per_periodo pu ON pu.per_codper = b.ultimo
 ORDER BY b.id`;

@Injectable()
export class ProcesosRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Por cuenta: activos en estado A, último periodo generado y el periodo siguiente (sugerido). */
  resumenCuentas(): Promise<ResumenCuenta[]> {
    return this.db.query<ResumenCuenta>(
      `SELECT r.cuenta "cuenta", r.descripcion "descripcion", r.activos "activos", r.ultimo "ultimoPeriodo",
              (SELECT s.per_codper FROM depreciaciones.dep_per_periodo s
                WHERE s.per_correlativo = (SELECT p.per_correlativo + 1 FROM depreciaciones.dep_per_periodo p
                                            WHERE p.per_codper = r.ultimo)) "siguientePeriodo"
         FROM (SELECT b.cta_codigo cuenta, b.cta_descripcion descripcion,
                      COUNT(DISTINCT CASE WHEN c.crtl_estado = 'A' THEN c.crtl_correlativo END) activos,
                      MAX(CASE WHEN c.crtl_estado = 'A' THEN d.det_codper END) ultimo
                 FROM depreciaciones.dep_cuenta b
                 LEFT JOIN depreciaciones.dep_detrel_cuentas a ON a.rel_codcta = b.cta_codigo
                 LEFT JOIN depreciaciones.dep_control_depreciacion c ON c.crtl_codrel_cta = a.rel_codigo
                 LEFT JOIN depreciaciones.dep_detctrl_depreciacion d ON d.det_codcrtl = c.crtl_correlativo
                GROUP BY b.cta_codigo, b.cta_descripcion) r
        ORDER BY r.cuenta`,
    );
  }

  async periodo(codigo: number): Promise<PeriodoProceso | null> {
    const r = await this.db.query<PeriodoProceso>(
      `SELECT per_codper "codigo", per_estado "estado",
              TO_CHAR(per_fecha_inicio, 'YYYY-MM-DD') "fechaInicio", TO_CHAR(per_fecha_final, 'YYYY-MM-DD') "fechaFinal"
         FROM depreciaciones.dep_per_periodo WHERE per_codper = :codigo`,
      { codigo },
    );
    return r[0] ?? null;
  }

  async existeCuenta(cuenta: number): Promise<boolean> {
    const r = await this.db.query<{ N: number }>(`SELECT COUNT(*) n FROM depreciaciones.dep_cuenta WHERE cta_codigo = :cuenta`, {
      cuenta,
    });
    return r[0]?.N > 0;
  }

  async vista(cuenta: number, periodo: number): Promise<ActivoProceso[]> {
    const rows = await this.db.query<Omit<ActivoProceso, 'ultimoMes'> & { ultimoMes: number }>(SQL_VISTA, { cuenta, periodo });
    return rows.map((r) => ({ ...r, ultimoMes: r.ultimoMes === 1 }));
  }

  /** Filas del periodo en la cuenta y activos de la cuenta en estado D (para medir el resultado). */
  async conteo(cuenta: number, periodo: number): Promise<{ filas: number; depreciados: number }> {
    const r = await this.db.query<{ FILAS: number; DEPRECIADOS: number }>(
      `SELECT (SELECT COUNT(*) FROM depreciaciones.dep_detctrl_depreciacion d
                 JOIN depreciaciones.dep_control_depreciacion c ON c.crtl_correlativo = d.det_codcrtl
                 JOIN depreciaciones.dep_detrel_cuentas a ON a.rel_codigo = c.crtl_codrel_cta
                WHERE a.rel_codcta = :cuenta AND d.det_codper = :periodo) filas,
              (SELECT COUNT(*) FROM depreciaciones.dep_control_depreciacion c
                 JOIN depreciaciones.dep_detrel_cuentas a ON a.rel_codigo = c.crtl_codrel_cta
                WHERE a.rel_codcta = :cuenta AND c.crtl_estado = 'D') depreciados
         FROM dual`,
      { cuenta, periodo },
    );
    return { filas: r[0].FILAS, depreciados: r[0].DEPRECIADOS };
  }

  /** DEP_GENERACION_MENSUAL hace COMMIT al final o ROLLBACK de todo si algún activo falla. */
  async generar(usuario: string, cuenta: number, periodo: number): Promise<string> {
    const r = await this.db.execute<unknown>(
      `BEGIN depreciaciones.dep_generacion_mensual(:usuario, :cuenta, :periodo, :clave); END;`,
      {
        usuario,
        cuenta,
        periodo,
        clave: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
      },
    );
    return ((r.outBinds as { clave: string | null }).clave ?? '').trim();
  }
}
