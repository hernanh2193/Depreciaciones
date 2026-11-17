import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export interface DatoCuenta {
  cuenta: number;
  descripcion: string;
  cantidad: number;
  valor: number;
}

export interface DatoMes {
  mes: number;
  cantidad: number;
  valor: number;
}

/** Consultas de las gráficas (GrafCuentaDal y GrafEstaActivoMesDal), con bind variables. */
@Injectable()
export class GraficasRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Cantidad de activos y valor de compra por cuenta. Java contaba también los anulados; aquí se excluyen
   * por defecto (incluirAnulados permite verlos como antes).
   */
  porCuenta(incluirAnulados: boolean): Promise<DatoCuenta[]> {
    return this.db.query<DatoCuenta>(
      `SELECT b.cta_codigo "cuenta", b.cta_descripcion "descripcion",
              COUNT(e.crtl_correlativo) "cantidad", NVL(SUM(e.crtl_valor_original), 0) "valor"
         FROM depreciaciones.dep_cuenta b
         JOIN depreciaciones.dep_detrel_cuentas a ON a.rel_codcta = b.cta_codigo
         JOIN depreciaciones.dep_control_depreciacion e ON e.crtl_codrel_cta = a.rel_codigo
        WHERE (:anulados = 1 OR e.crtl_estado <> 'I')
        GROUP BY b.cta_codigo, b.cta_descripcion
        ORDER BY b.cta_codigo`,
      { anulados: incluirAnulados ? 1 : 0 },
    );
  }

  /**
   * Activos comprados (por fecha de inicio) en cada mes de un año, de una cuenta o de todas.
   * Java sumaba crtl_valor_mensual (la depreciación mensual) aunque la gráfica es de compras: aquí se suma el
   * valor de compra (crtl_valor_original). Siempre devuelve los 12 meses (Java omitía los meses sin compras).
   */
  async comprasPorMes(anio: number, cuenta: number | null): Promise<DatoMes[]> {
    const filas = await this.db.query<DatoMes>(
      `SELECT TO_NUMBER(TO_CHAR(e.crtl_fecha_inicio, 'MM')) "mes",
              COUNT(e.crtl_correlativo) "cantidad", NVL(SUM(e.crtl_valor_original), 0) "valor"
         FROM depreciaciones.dep_control_depreciacion e
         JOIN depreciaciones.dep_detrel_cuentas a ON a.rel_codigo = e.crtl_codrel_cta
        WHERE e.crtl_estado <> 'I'
          AND e.crtl_fecha_inicio >= TO_DATE(:anio || '-01-01', 'YYYY-MM-DD')
          AND e.crtl_fecha_inicio <  TO_DATE((:anio + 1) || '-01-01', 'YYYY-MM-DD')
          AND (:cuenta IS NULL OR a.rel_codcta = :cuenta)
        GROUP BY TO_CHAR(e.crtl_fecha_inicio, 'MM')`,
      { anio, cuenta },
    );
    return Array.from({ length: 12 }, (_, i) => filas.find((f) => f.mes === i + 1) ?? { mes: i + 1, cantidad: 0, valor: 0 });
  }

  /** Años con compras, del más reciente al más antiguo (para la lista de años). */
  async anios(): Promise<number[]> {
    const r = await this.db.query<{ ANIO: number }>(
      `SELECT DISTINCT EXTRACT(YEAR FROM crtl_fecha_inicio) anio FROM depreciaciones.dep_control_depreciacion
        WHERE crtl_fecha_inicio IS NOT NULL ORDER BY 1 DESC`,
    );
    return r.map((x) => x.ANIO);
  }

  cuentas() {
    return this.db.query<{ valor: number; etiqueta: string }>(
      `SELECT cta_codigo "valor", cta_codigo || ' - ' || cta_descripcion "etiqueta" FROM depreciaciones.dep_cuenta ORDER BY cta_codigo`,
    );
  }
}
