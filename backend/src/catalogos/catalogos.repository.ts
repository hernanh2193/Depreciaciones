import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service.js';
import type {
  Cuenta,
  Division,
  EstadoPeriodo,
  Opcion,
  Periodo,
  Relacion,
  SubCuenta,
} from './catalogos.types.js';

/** SQL de los catálogos (equivalente a Cat*Dal.java). */
@Injectable()
export class CatalogosRepository {
  constructor(private readonly db: DatabaseService) {}

  // ---------- Cuentas (DEP_CUENTA) ----------

  listarCuentas(): Promise<Cuenta[]> {
    return this.db.query<Cuenta>(
      `SELECT cta_codigo "codigo", cta_descripcion "descripcion", cta_pct "porcentaje"
         FROM depreciaciones.dep_cuenta
        ORDER BY cta_codigo`,
    );
  }

  async insertarCuenta(c: Cuenta, usuario: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO depreciaciones.dep_cuenta
              (cta_codigo, cta_descripcion, cta_pct, cta_fecha_crea, cta_usuario_crea)
       VALUES (:codigo, UPPER(:descripcion), :porcentaje, SYSDATE, :usuario)`,
      { codigo: c.codigo, descripcion: c.descripcion, porcentaje: c.porcentaje, usuario },
    );
  }

  // ---------- Subcuentas (DEP_SUB_CUENTA) ----------

  listarSubCuentas(): Promise<SubCuenta[]> {
    return this.db.query<SubCuenta>(
      `SELECT sub_correla "correlativo", sub_codigo "codigo", sub_descripcion "descripcion", sub_pct "porcentaje"
         FROM depreciaciones.dep_sub_cuenta
        ORDER BY sub_correla DESC`,
    );
  }

  /** Usa DEP_INSERTA_SUBCUENTA. Devuelve '0' si se insertó, o el texto de error del procedimiento. */
  insertarSubCuenta(codigo: number, descripcion: string, porcentaje: number, usuario: string) {
    return this.llamarInsercion('dep_inserta_subcuenta', [codigo, descripcion, porcentaje, usuario]);
  }

  // ---------- Divisiones (DEP_SUB_DIV_CUENTA) ----------

  listarDivisiones(): Promise<Division[]> {
    return this.db.query<Division>(
      `SELECT div_correla "correlativo", div_codigo "codigo", div_descripcion "descripcion", div_pct "porcentaje"
         FROM depreciaciones.dep_sub_div_cuenta
        ORDER BY div_correla DESC`,
    );
  }

  /** Usa DEP_INSERTA_DIVCUENTA. */
  insertarDivision(codigo: number, descripcion: string, porcentaje: number, usuario: string) {
    return this.llamarInsercion('dep_inserta_divcuenta', [codigo, descripcion, porcentaje, usuario]);
  }

  // ---------- Relación de cuentas (DEP_DETREL_CUENTAS) ----------

  listarRelaciones(): Promise<Relacion[]> {
    return this.db.query<Relacion>(
      `SELECT a.rel_codigo "codigo",
              a.rel_codcta "cuentaCodigo", a.rel_codcta || ' - ' || b.cta_descripcion "cuenta",
              a.rel_codsub "subCuentaCorrelativo", c.sub_codigo || ' - ' || c.sub_descripcion "subCuenta",
              a.rel_coddiv "divisionCorrelativo",
              CASE WHEN d.div_correla IS NOT NULL THEN d.div_codigo || ' - ' || d.div_descripcion END "division"
         FROM depreciaciones.dep_detrel_cuentas a
         JOIN depreciaciones.dep_cuenta b ON b.cta_codigo = a.rel_codcta
         JOIN depreciaciones.dep_sub_cuenta c ON c.sub_correla = a.rel_codsub
         LEFT JOIN depreciaciones.dep_sub_div_cuenta d ON d.div_correla = a.rel_coddiv
        ORDER BY a.rel_codigo DESC`,
    );
  }

  async existeRelacion(cuenta: number, subCuenta: number, division: number | null): Promise<boolean> {
    const rows = await this.db.query<{ N: number }>(
      `SELECT COUNT(*) n FROM depreciaciones.dep_detrel_cuentas
        WHERE rel_codcta = :cuenta AND rel_codsub = :subCuenta
          AND (rel_coddiv = :division OR (rel_coddiv IS NULL AND :division IS NULL))`,
      { cuenta, subCuenta, division },
    );
    return (rows[0]?.N ?? 0) > 0;
  }

  /** Usa DEP_INSERTA_RELCUENTA. division = null equivale a "Sin división". */
  insertarRelacion(cuenta: number, subCuenta: number, division: number | null, usuario: string) {
    return this.llamarInsercion('dep_inserta_relcuenta', [cuenta, subCuenta, division, usuario]);
  }

  async opcionesCuenta(): Promise<Opcion[]> {
    return this.db.query<Opcion>(
      `SELECT cta_codigo "valor", cta_codigo || ' - ' || cta_descripcion "etiqueta"
         FROM depreciaciones.dep_cuenta ORDER BY cta_codigo`,
    );
  }

  async opcionesSubCuenta(): Promise<Opcion[]> {
    return this.db.query<Opcion>(
      `SELECT sub_correla "valor", sub_codigo || ' - ' || sub_descripcion "etiqueta"
         FROM depreciaciones.dep_sub_cuenta ORDER BY sub_correla`,
    );
  }

  async opcionesDivision(): Promise<Opcion[]> {
    return this.db.query<Opcion>(
      `SELECT div_correla "valor", div_codigo || ' - ' || div_descripcion "etiqueta"
         FROM depreciaciones.dep_sub_div_cuenta ORDER BY div_correla`,
    );
  }

  // ---------- Periodos (DEP_PER_PERIODO) ----------

  listarPeriodos(): Promise<Periodo[]> {
    return this.db.query<Periodo>(
      `SELECT per_correlativo "correlativo", per_codper "codigo",
              TO_CHAR(per_fecha_inicio, 'YYYY-MM-DD') "fechaInicio",
              TO_CHAR(per_fecha_final, 'YYYY-MM-DD') "fechaFinal",
              per_estado "estado"
         FROM depreciaciones.dep_per_periodo
        ORDER BY per_codper DESC`,
    );
  }

  /** Correlativo = MAX + 1 dentro de la misma transacción (igual que CatPeriodoDal.java). */
  insertarPeriodo(p: Omit<Periodo, 'correlativo'>, usuario: string): Promise<number> {
    return this.db.transaction(async (conn) => {
      const r = await conn.execute<{ N: number }>(
        `SELECT NVL(MAX(per_correlativo), 0) + 1 n FROM depreciaciones.dep_per_periodo`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const correlativo = r.rows![0].N;
      await conn.execute(
        `INSERT INTO depreciaciones.dep_per_periodo
                (per_correlativo, per_codper, per_fecha_inicio, per_fecha_final, per_estado,
                 per_fecha_crea, per_usuario_crea)
         VALUES (:correlativo, :codigo, TO_DATE(:fechaInicio, 'YYYY-MM-DD'), TO_DATE(:fechaFinal, 'YYYY-MM-DD'),
                 :estado, SYSDATE, :usuario)`,
        {
          correlativo,
          codigo: p.codigo,
          fechaInicio: p.fechaInicio,
          fechaFinal: p.fechaFinal,
          estado: p.estado satisfies EstadoPeriodo,
          usuario,
        },
      );
      return correlativo;
    });
  }

  // ---------- Común ----------

  /** Llama a un procedimiento DEP_INSERTA_* (4 parámetros IN + P_CLAVE OUT) y devuelve P_CLAVE. */
  private async llamarInsercion(
    procedimiento: 'dep_inserta_subcuenta' | 'dep_inserta_divcuenta' | 'dep_inserta_relcuenta',
    params: [number, string | number, number | null, string],
  ): Promise<string> {
    const r = await this.db.execute<unknown>(
      `BEGIN depreciaciones.${procedimiento}(:p1, :p2, :p3, :p4, :clave); END;`,
      {
        p1: params[0],
        p2: params[1],
        p3: params[2],
        p4: params[3],
        clave: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 2000 },
      },
    );
    return ((r.outBinds as { clave: string | null }).clave ?? '').trim();
  }
}
