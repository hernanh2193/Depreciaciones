import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

/** Relación de cuentas con sus descripciones (cuenta / subcuenta / división). */
const REL = `
  FROM depreciaciones.dep_detrel_cuentas a
  JOIN depreciaciones.dep_cuenta b ON b.cta_codigo = a.rel_codcta
  JOIN depreciaciones.dep_sub_cuenta c ON c.sub_correla = a.rel_codsub
  LEFT JOIN depreciaciones.dep_sub_div_cuenta d ON d.div_correla = a.rel_coddiv`;

export interface FilaCatalogo {
  RELACION: number;
  CUENTA: string;
  SUBCUENTA: string;
  DIVISION: string;
  PCT: number | null;
}

export interface CabeceraRelacion {
  RELACION: number;
  CTA_CODIGO: number;
  CUENTA: string;
  SUBCUENTA: string;
  DIVISION: string;
  PCT: number | null;
}

export interface ActivoReporte {
  CORRELATIVO: number;
  SUBCUENTA: string;
  DESCRIPCION: string;
  PCT: number | null;
  VALOR: number;
  MENSUAL: number;
  FECHA_INICIO: string | null;
  TARJETA: string | null;
  CUENTA_PPTO: number | null;
  CONSTANCIA: string | null;
  ESTADO: string;
}

export interface CabeceraActivo {
  CORRELATIVO: number;
  TARJETA: string | null;
  TARJETA_CONTABLE: string;
  CUENTA_PPTO: number | null;
  CUENTA_NOMBRE: string;
  VALOR: number;
  PCT: number | null;
  DESCRIPCION: string;
  ESTADO: string;
}

export interface DetalleTarjeta {
  CORRELATIVO: number;
  PERIODO: number;
  DESCRIPCION: string | null;
  SALDO_INICIAL: number;
  FACTOR: number;
  DEPRECIA_MES: number;
  DEPRECIA_ACUM: number;
  VALOR_LIBROS: number;
  OBSERVACIONES: string | null;
}

export interface FilaPorSubcuenta {
  CUENTA: string;
  NOMBRE: string;
  VALOR: number;
  ORIGINAL?: number;
}

export interface FilaResumen {
  CUENTA: string;
  NOMBRE: string;
  ANTERIOR: number;
  INCREMENTO: string | null;
  FINALIZA: string | null;
  ACTUAL: number;
}

export interface FilaConsolidado {
  CORRELATIVO: number;
  DESCRIPCION: string;
  ACUM_ANT: number;
  VALOR: number;
  MESES: number[];
  ACUM_ACT: number;
}

/**
 * SQL de los 8 reportes (Rep*Dal.java). Mismas consultas que Java, con bind variables en lugar de concatenar
 * los parámetros y con las correcciones indicadas en cada método.
 */
@Injectable()
export class ReportesRepository {
  constructor(private readonly db: DatabaseService) {}

  // ---------- Opciones para los parámetros ----------

  cuentas() {
    return this.db.query<{ valor: number; etiqueta: string }>(
      `SELECT cta_codigo "valor", cta_codigo || ' - ' || cta_descripcion "etiqueta" FROM depreciaciones.dep_cuenta ORDER BY cta_codigo`,
    );
  }

  relaciones() {
    return this.db.query<{ valor: number; etiqueta: string }>(
      `SELECT a.rel_codigo "valor",
              a.rel_codigo || '. ' || a.rel_codcta || ' / ' || c.sub_codigo || ' - ' || c.sub_descripcion
                || ' / ' || NVL2(d.div_correla, d.div_codigo || ' - ' || d.div_descripcion, 'SIN DIVISIÓN') "etiqueta"
       ${REL} ORDER BY a.rel_codigo`,
    );
  }

  async existePeriodo(periodo: number): Promise<boolean> {
    const r = await this.db.query<{ N: number }>(`SELECT COUNT(*) n FROM depreciaciones.dep_per_periodo WHERE per_codper = :periodo`, {
      periodo,
    });
    return r[0].N > 0;
  }

  // ---------- 1. Catálogo de cuentas (RepCuentaRel) ----------

  catalogo(): Promise<FilaCatalogo[]> {
    return this.db.query<FilaCatalogo>(
      `SELECT a.rel_codigo relacion, a.rel_codcta || ' - ' || b.cta_descripcion cuenta,
              c.sub_codigo || ' - ' || c.sub_descripcion subcuenta,
              NVL2(d.div_correla, d.div_codigo || ' - ' || d.div_descripcion, 'SIN DIVISIÓN') division,
              NVL(d.div_pct, c.sub_pct) pct
       ${REL}
        ORDER BY a.rel_codcta, c.sub_codigo, d.div_codigo NULLS FIRST`,
    );
  }

  // ---------- 2. Relación de cuentas (RepRCuentaActivo) ----------

  async cabeceraRelacion(relacion: number): Promise<CabeceraRelacion | null> {
    const r = await this.db.query<CabeceraRelacion>(
      `SELECT a.rel_codigo relacion, b.cta_codigo, b.cta_codigo || ' - ' || b.cta_descripcion cuenta,
              c.sub_codigo || ' - ' || c.sub_descripcion subcuenta,
              NVL2(d.div_correla, d.div_codigo || ' - ' || d.div_descripcion, 'SIN DIVISIÓN') division,
              NVL(d.div_pct, c.sub_pct) pct
       ${REL} WHERE a.rel_codigo = :relacion`,
      { relacion },
    );
    return r[0] ?? null;
  }

  /** Activos no anulados de una relación (o de una cuenta), en el orden de Java: subcuenta y número. */
  activos(filtro: { relacion?: number; cuenta?: number }): Promise<ActivoReporte[]> {
    return this.db.query<ActivoReporte>(
      `SELECT e.crtl_correlativo correlativo,
              CASE WHEN d.div_correla IS NOT NULL THEN d.div_codigo || ' - ' || UPPER(d.div_descripcion)
                   ELSE c.sub_codigo || ' - ' || UPPER(c.sub_descripcion) END subcuenta,
              e.crtl_descripcion descripcion, NVL(d.div_pct, c.sub_pct) pct,
              e.crtl_valor_original valor, e.crtl_valor_mensual mensual,
              TO_CHAR(e.crtl_fecha_inicio, 'YYYY-MM-DD') fecha_inicio, e.crtl_no_tarjeta tarjeta,
              e.crtl_cuenta_ppto cuenta_ppto, e.crtl_no_constancia constancia, e.crtl_estado estado
       ${REL}
         JOIN depreciaciones.dep_control_depreciacion e ON e.crtl_codrel_cta = a.rel_codigo
        WHERE e.crtl_estado <> 'I'
          AND (:relacion IS NULL OR a.rel_codigo = :relacion)
          AND (:cuenta IS NULL OR a.rel_codcta = :cuenta)
        ORDER BY c.sub_codigo, d.div_codigo NULLS FIRST, e.crtl_correlativo`,
      { relacion: filtro.relacion ?? null, cuenta: filtro.cuenta ?? null },
    );
  }

  async cuenta(codigo: number): Promise<{ CODIGO: number; DESCRIPCION: string; PCT: number | null } | null> {
    const r = await this.db.query<{ CODIGO: number; DESCRIPCION: string; PCT: number | null }>(
      `SELECT cta_codigo codigo, cta_descripcion descripcion, cta_pct pct FROM depreciaciones.dep_cuenta WHERE cta_codigo = :codigo`,
      { codigo },
    );
    return r[0] ?? null;
  }

  // ---------- 3. Tarjeta auxiliar de depreciación (RepActDeprecia) ----------

  /** Java filtraba los anulados en el encabezado pero no en el detalle: con un activo anulado salía en blanco. */
  async cabeceraActivo(correlativo: number): Promise<CabeceraActivo | null> {
    const r = await this.db.query<CabeceraActivo>(
      `SELECT e.crtl_correlativo correlativo, e.crtl_no_tarjeta tarjeta, a.rel_codcta || '.' || c.sub_codigo tarjeta_contable,
              e.crtl_cuenta_ppto cuenta_ppto, UPPER(b.cta_descripcion) cuenta_nombre, e.crtl_valor_original valor,
              NVL(d.div_pct, c.sub_pct) pct, e.crtl_descripcion descripcion, e.crtl_estado estado
       ${REL}
         JOIN depreciaciones.dep_control_depreciacion e ON e.crtl_codrel_cta = a.rel_codigo
        WHERE e.crtl_correlativo = :correlativo`,
      { correlativo },
    );
    return r[0] ?? null;
  }

  detalleTarjeta(correlativo: number): Promise<DetalleTarjeta[]> {
    return this.db.query<DetalleTarjeta>(
      `SELECT det_correlativo correlativo, det_codper periodo, TRIM(det_descripcion) descripcion,
              det_saldo_inicial saldo_inicial, det_factor factor, det_deprecia_mes deprecia_mes,
              det_deprecia_acum deprecia_acum, det_valor_libros valor_libros, det_observaciones observaciones
         FROM depreciaciones.dep_detctrl_depreciacion
        WHERE det_codcrtl = :correlativo
        ORDER BY det_correlativo`,
      { correlativo },
    );
  }

  // ---------- 5. Acumulado mensual (RepDepreciaMes) y 6. Resumen por cuenta (RepResXCuenta) ----------

  /** Suma de la depreciación ACUMULADA del periodo por cuenta.subcuenta (todas las cuentas). */
  acumuladoMensual(periodo: number): Promise<FilaPorSubcuenta[]> {
    return this.db.query<FilaPorSubcuenta>(
      `SELECT b.cta_codigo || '.' || c.sub_codigo cuenta, c.sub_descripcion nombre, SUM(f.det_deprecia_acum) valor
       ${REL}
         JOIN depreciaciones.dep_control_depreciacion e ON e.crtl_codrel_cta = a.rel_codigo
         JOIN depreciaciones.dep_detctrl_depreciacion f ON f.det_codcrtl = e.crtl_correlativo
        WHERE e.crtl_estado <> 'I' AND f.det_codper = :periodo
        GROUP BY b.cta_codigo, c.sub_codigo, c.sub_descripcion
        ORDER BY b.cta_codigo, c.sub_codigo`,
      { periodo },
    );
  }

  /** Valor original y depreciación DEL MES del periodo por subcuenta de una cuenta. */
  resumenPorCuenta(periodo: number, cuenta: number): Promise<FilaPorSubcuenta[]> {
    return this.db.query<FilaPorSubcuenta>(
      `SELECT b.cta_codigo || '.' || c.sub_codigo cuenta, c.sub_descripcion nombre,
              SUM(e.crtl_valor_original) original, SUM(f.det_deprecia_mes) valor
       ${REL}
         JOIN depreciaciones.dep_control_depreciacion e ON e.crtl_codrel_cta = a.rel_codigo
         JOIN depreciaciones.dep_detctrl_depreciacion f ON f.det_codcrtl = e.crtl_correlativo
        WHERE e.crtl_estado <> 'I' AND f.det_codper = :periodo AND b.cta_codigo = :cuenta
        GROUP BY b.cta_codigo, c.sub_codigo, c.sub_descripcion
        ORDER BY b.cta_codigo, c.sub_codigo`,
      { periodo, cuenta },
    );
  }

  // ---------- 7. Resumen de depreciación mensual (RepResumen) ----------

  /**
   * Depreciación del mes anterior y del mes por subcuenta, con los textos de MesIncremento (activos que inician)
   * y MesFinaliza (activos que terminan) de la base de datos. En Java, si el mes anterior no tenía depreciación
   * el valor era NULL y el PDF no se generaba: aquí es 0.
   */
  resumenMensual(periodo: number): Promise<FilaResumen[]> {
    return this.db.query<FilaResumen>(
      `SELECT x.cuenta, x.nombre, NVL(x.anterior, 0) anterior,
              depreciaciones.mesincremento(x.cta, x.sub, x.fecha) incremento,
              depreciaciones.mesfinaliza(x.cta, x.sub, x.fecha) finaliza,
              x.actual
         FROM (SELECT b.cta_codigo || '.' || c.sub_codigo cuenta, b.cta_codigo cta, c.sub_codigo sub,
                      c.sub_descripcion nombre, g.per_fecha_inicio fecha,
                      (SELECT SUM(w.det_deprecia_mes)
                         FROM depreciaciones.dep_detrel_cuentas r
                         JOIN depreciaciones.dep_sub_cuenta t ON t.sub_correla = r.rel_codsub
                         JOIN depreciaciones.dep_control_depreciacion v ON v.crtl_codrel_cta = r.rel_codigo
                         JOIN depreciaciones.dep_detctrl_depreciacion w ON w.det_codcrtl = v.crtl_correlativo
                         JOIN depreciaciones.dep_per_periodo z ON z.per_codper = w.det_codper
                        WHERE r.rel_codcta = b.cta_codigo AND t.sub_codigo = c.sub_codigo
                          AND z.per_fecha_inicio = ADD_MONTHS(g.per_fecha_inicio, -1)) anterior,
                      NVL(SUM(f.det_deprecia_mes), 0) actual
               ${REL}
                 JOIN depreciaciones.dep_control_depreciacion e ON e.crtl_codrel_cta = a.rel_codigo
                 JOIN depreciaciones.dep_detctrl_depreciacion f ON f.det_codcrtl = e.crtl_correlativo
                 JOIN depreciaciones.dep_per_periodo g ON g.per_codper = f.det_codper
                WHERE e.crtl_estado <> 'I' AND f.det_codper = :periodo
                GROUP BY b.cta_codigo, c.sub_codigo, c.sub_descripcion, g.per_fecha_inicio) x
        ORDER BY x.cta, x.sub`,
      { periodo },
    );
  }

  // ---------- 8. Consolidación por año (RepConsolidaAcum) ----------

  /**
   * Activos de la relación con la depreciación de cada mes del año, el acumulado al cierre del año anterior y el
   * acumulado al cierre del año. Incluye (con meses en 0) los activos ya depreciados antes del año, como Java.
   * Corrección: ACUMULADO_AL ya resta 1 al año internamente; Java le pasaba año-1 y mostraba el acumulado de
   * dos años atrás.
   */
  async consolidado(relacion: number, anio: number): Promise<FilaConsolidado[]> {
    const meses = Array.from({ length: 12 }, (_, i) => `SUM(CASE WHEN f.det_codper = :anio * 100 + ${i + 1} THEN f.det_deprecia_mes ELSE 0 END) m${i + 1}`);
    const rows = await this.db.query<Record<string, number | string>>(
      `SELECT y.correlativo, y.descripcion, y.acum_ant, y.valor,
              ${Array.from({ length: 12 }, (_, i) => `y.m${i + 1}`).join(', ')},
              -- ACUMULADO_DEL devuelve 0 si el activo no tuvo meses en el año (ya estaba depreciado): en ese caso el
              -- acumulado al cierre del año es el del año anterior (Java mostraba 0)
              CASE WHEN y.acum_del = 0 THEN y.acum_ant ELSE y.acum_del END acum_act
         FROM (
       SELECT x.correlativo, x.descripcion, depreciaciones.acumulado_al(x.correlativo, :anio) acum_ant, x.valor,
              ${Array.from({ length: 12 }, (_, i) => `x.m${i + 1}`).join(', ')},
              depreciaciones.acumulado_del(x.correlativo, :anio) acum_del
         FROM (SELECT e.crtl_correlativo correlativo, e.crtl_descripcion descripcion, e.crtl_valor_original valor,
                      ${meses.join(',\n                      ')}
                 FROM depreciaciones.dep_control_depreciacion e
                 JOIN depreciaciones.dep_detctrl_depreciacion f ON f.det_codcrtl = e.crtl_correlativo
                WHERE e.crtl_codrel_cta = :relacion AND e.crtl_estado <> 'I'
                  AND (f.det_codper BETWEEN :anio * 100 + 1 AND :anio * 100 + 12
                       OR (e.crtl_estado = 'D' AND f.det_valor_libros = 1 AND f.det_codper < :anio * 100 + 1))
                GROUP BY e.crtl_correlativo, e.crtl_descripcion, e.crtl_valor_original) x) y
        ORDER BY y.correlativo`,
      { relacion, anio },
    );
    return rows.map((r) => ({
      CORRELATIVO: Number(r.CORRELATIVO),
      DESCRIPCION: String(r.DESCRIPCION ?? ''),
      ACUM_ANT: Number(r.ACUM_ANT ?? 0),
      VALOR: Number(r.VALOR ?? 0),
      MESES: Array.from({ length: 12 }, (_, i) => Number(r[`M${i + 1}`] ?? 0)),
      ACUM_ACT: Number(r.ACUM_ACT ?? 0),
    }));
  }
}
