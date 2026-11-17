import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { EstadoActivo } from '../activos/activos.types.js';

/** Fila de las consultas de activos (ConsulBuscaActivo, ConsulActivos y ConsulCuenta en Java). */
export interface ActivoConsulta {
  correlativo: number;
  tarjeta: string | null;
  cuentaPresupuesto: number | null;
  descripcion: string;
  cuenta: number;
  relacion: number;
  subCuenta: string;
  division: string;
  fechaInicio: string | null;
  fechaFinal: string | null;
  valorOriginal: number;
  valorMensual: number;
  depreciacionAcumulada: number;
  valorLibros: number | null;
  ultimoPeriodo: number | null;
  estado: EstadoActivo;
  noConstancia: string | null;
}

export interface FiltroConsulta {
  texto: string | null;
  estado: EstadoActivo | null;
  cuenta: number | null;
  relacion: number | null;
  limite: number;
}

export interface Totales {
  activos: number;
  valorOriginal: number;
  valorMensual: number;
  depreciacionAcumulada: number;
  valorLibros: number;
}

const FILTRO_SQL = `
  FROM depreciaciones.dep_control_depreciacion e
  JOIN depreciaciones.dep_detrel_cuentas a ON a.rel_codigo = e.crtl_codrel_cta
  JOIN depreciaciones.dep_sub_cuenta c ON c.sub_correla = a.rel_codsub
  LEFT JOIN depreciaciones.dep_sub_div_cuenta d ON d.div_correla = a.rel_coddiv
  LEFT JOIN depreciaciones.dep_detctrl_depreciacion u
         ON u.det_codcrtl = e.crtl_correlativo
        AND u.det_correlativo = (SELECT MAX(m.det_correlativo) FROM depreciaciones.dep_detctrl_depreciacion m
                                  WHERE m.det_codcrtl = e.crtl_correlativo)
 WHERE (:texto IS NULL
        OR TO_CHAR(e.crtl_correlativo) = :texto
        OR UPPER(TRIM(e.crtl_no_tarjeta)) = UPPER(:texto)
        OR UPPER(e.crtl_descripcion) LIKE '%' || UPPER(:texto) || '%')
   AND (:estado IS NULL OR e.crtl_estado = :estado)
   AND (:cuenta IS NULL OR a.rel_codcta = :cuenta)
   AND (:relacion IS NULL OR a.rel_codigo = :relacion)`;

/** Consultas de solo lectura. Siempre con bind variables (Java concatenaba los valores en el SQL). */
@Injectable()
export class ConsultasRepository {
  constructor(private readonly db: DatabaseService) {}

  activos(f: FiltroConsulta): Promise<ActivoConsulta[]> {
    return this.db.query<ActivoConsulta>(
      `SELECT e.crtl_correlativo "correlativo", e.crtl_no_tarjeta "tarjeta", e.crtl_cuenta_ppto "cuentaPresupuesto",
              SUBSTR(e.crtl_descripcion, 1, 400) "descripcion", a.rel_codcta "cuenta", a.rel_codigo "relacion",
              c.sub_codigo || ' - ' || c.sub_descripcion "subCuenta",
              NVL2(d.div_correla, d.div_codigo || ' - ' || d.div_descripcion, 'SIN DIVISIÓN') "division",
              TO_CHAR(e.crtl_fecha_inicio, 'YYYY-MM-DD') "fechaInicio", TO_CHAR(e.crtl_fecha_final, 'YYYY-MM-DD') "fechaFinal",
              e.crtl_valor_original "valorOriginal", e.crtl_valor_mensual "valorMensual",
              NVL(u.det_deprecia_acum, 0) "depreciacionAcumulada", u.det_valor_libros "valorLibros",
              u.det_codper "ultimoPeriodo", e.crtl_estado "estado", e.crtl_no_constancia "noConstancia"
       ${FILTRO_SQL}
        ORDER BY a.rel_codcta, c.sub_codigo, d.div_codigo NULLS FIRST, e.crtl_correlativo
        FETCH FIRST :limite ROWS ONLY`,
      { ...binds(f), limite: f.limite },
    );
  }

  /** Totales de TODO el filtro (no solo de las filas devueltas). */
  async totales(f: FiltroConsulta): Promise<Totales> {
    const r = await this.db.query<Totales>(
      `SELECT COUNT(*) "activos", NVL(SUM(e.crtl_valor_original), 0) "valorOriginal",
              NVL(SUM(e.crtl_valor_mensual), 0) "valorMensual", NVL(SUM(u.det_deprecia_acum), 0) "depreciacionAcumulada",
              NVL(SUM(NVL(u.det_valor_libros, e.crtl_valor_original)), 0) "valorLibros"
       ${FILTRO_SQL}`,
      binds(f),
    );
    return r[0];
  }

  /** Cuentas y relaciones para los filtros (los 4 roles; el catálogo de relaciones no es visible para Auditoría). */
  async opciones() {
    const [cuentas, relaciones] = await Promise.all([
      this.db.query<{ valor: number; etiqueta: string }>(
        `SELECT cta_codigo "valor", cta_codigo || ' - ' || cta_descripcion "etiqueta"
           FROM depreciaciones.dep_cuenta ORDER BY cta_codigo`,
      ),
      this.db.query<{ valor: number; etiqueta: string; cuenta: number }>(
        `SELECT a.rel_codigo "valor", a.rel_codcta "cuenta",
                a.rel_codigo || '. ' || a.rel_codcta || ' / ' || c.sub_codigo || ' - ' || c.sub_descripcion
                  || ' / ' || NVL2(d.div_correla, d.div_codigo || ' - ' || d.div_descripcion, 'SIN DIVISIÓN') "etiqueta"
           FROM depreciaciones.dep_detrel_cuentas a
           JOIN depreciaciones.dep_sub_cuenta c ON c.sub_correla = a.rel_codsub
           LEFT JOIN depreciaciones.dep_sub_div_cuenta d ON d.div_correla = a.rel_coddiv
          ORDER BY a.rel_codigo`,
      ),
    ]);
    return { cuentas, relaciones };
  }
}

const binds = (f: FiltroConsulta) => ({ texto: f.texto, estado: f.estado, cuenta: f.cuenta, relacion: f.relacion });
