import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service.js';
import type {
  Activo,
  ActivoResumen,
  DatosActivo,
  DetalleDepreciacion,
  EstadoActivo,
  OtroPorcentaje,
  RelacionConPorcentaje,
} from './activos.types.js';

const OBJ = { outFormat: oracledb.OUT_FORMAT_OBJECT };

/** Procedimientos que generan el detalle mensual de depreciación (firma: usuario, activo, fecha, clave OUT). */
export type ProcedimientoGeneracion = 'dep_generacion_mes' | 'dep_generacion_porcant';

/** Porcentaje de la relación: el de la división si existe, si no el de la subcuenta. */
const SQL_RELACION = `
  FROM depreciaciones.dep_detrel_cuentas a
  JOIN depreciaciones.dep_cuenta b ON b.cta_codigo = a.rel_codcta
  JOIN depreciaciones.dep_sub_cuenta c ON c.sub_correla = a.rel_codsub
  LEFT JOIN depreciaciones.dep_sub_div_cuenta d ON d.div_correla = a.rel_coddiv`;

/** SQL de activos (equivalente a CatActivo*Dal.java), siempre con bind variables. */
@Injectable()
export class ActivosRepository {
  constructor(private readonly db: DatabaseService) {}

  relaciones(): Promise<RelacionConPorcentaje[]> {
    return this.db.query<RelacionConPorcentaje>(
      `SELECT a.rel_codigo "codigo",
              a.rel_codcta || ' - ' || b.cta_descripcion || ' / ' || c.sub_codigo || ' - ' || c.sub_descripcion
                || ' / ' || NVL2(d.div_correla, d.div_codigo || ' - ' || d.div_descripcion, 'SIN DIVISIÓN') "etiqueta",
              NVL(d.div_pct, c.sub_pct) "porcentaje"
       ${SQL_RELACION}
        ORDER BY a.rel_codigo`,
    );
  }

  async porcentajeRelacion(relacion: number): Promise<number | null> {
    const r = await this.db.query<{ PCT: number }>(
      `SELECT NVL(d.div_pct, c.sub_pct) pct ${SQL_RELACION} WHERE a.rel_codigo = :relacion`,
      { relacion },
    );
    return r[0]?.PCT ?? null;
  }

  /** Busca por correlativo o tarjeta exactos, o por texto en la descripción. */
  buscar(texto: string | null, estado: EstadoActivo | null, limite: number): Promise<ActivoResumen[]> {
    return this.db.query<ActivoResumen>(
      `SELECT e.crtl_correlativo "correlativo", e.crtl_no_tarjeta "tarjeta",
              SUBSTR(e.crtl_descripcion, 1, 300) "descripcion",
              a.rel_codcta || ' / ' || c.sub_codigo || NVL2(d.div_correla, ' / ' || d.div_codigo, '') "relacion",
              TO_CHAR(e.crtl_fecha_inicio, 'YYYY-MM-DD') "fechaInicio",
              e.crtl_valor_original "valorOriginal", e.crtl_valor_mensual "valorMensual", e.crtl_estado "estado"
         FROM depreciaciones.dep_control_depreciacion e
         JOIN depreciaciones.dep_detrel_cuentas a ON a.rel_codigo = e.crtl_codrel_cta
         JOIN depreciaciones.dep_sub_cuenta c ON c.sub_correla = a.rel_codsub
         LEFT JOIN depreciaciones.dep_sub_div_cuenta d ON d.div_correla = a.rel_coddiv
        WHERE (:texto IS NULL
               OR TO_CHAR(e.crtl_correlativo) = :texto
               OR UPPER(TRIM(e.crtl_no_tarjeta)) = UPPER(:texto)
               OR UPPER(e.crtl_descripcion) LIKE '%' || UPPER(:texto) || '%')
          AND (:estado IS NULL OR e.crtl_estado = :estado)
        ORDER BY e.crtl_correlativo DESC
        FETCH FIRST :limite ROWS ONLY`,
      { texto, estado, limite },
    );
  }

  async obtener(correlativo: number): Promise<Activo | null> {
    const rows = await this.db.query<Activo & { TIENE_OTRO: number }>(
      `SELECT e.crtl_correlativo "correlativo", e.crtl_codrel_cta "relacionCodigo",
              a.rel_codcta || ' - ' || b.cta_descripcion "cuenta",
              c.sub_codigo || ' - ' || c.sub_descripcion "subCuenta",
              NVL2(d.div_correla, d.div_codigo || ' - ' || d.div_descripcion, 'SIN DIVISIÓN') "division",
              NVL(d.div_pct, c.sub_pct) "porcentaje",
              e.crtl_descripcion "descripcion", e.crtl_no_tarjeta "tarjeta", e.crtl_cuenta_ppto "cuentaPresupuesto",
              TO_CHAR(e.crtl_fecha_inicio, 'YYYY-MM-DD') "fechaInicio",
              TO_CHAR(e.crtl_fecha_final, 'YYYY-MM-DD') "fechaFinal",
              e.crtl_valor_original "valorOriginal", e.crtl_valor_mensual "valorMensual", e.crtl_factor "factor",
              e.crtl_estado "estado", e.crtl_no_constancia "noConstancia",
              TO_CHAR(e.crtl_fecha_constancia, 'YYYY-MM-DD') "fechaConstancia", e.crtl_no_cur "noCur",
              e.crtl_marca "marca", e.crtl_modelo "modelo", e.crtl_serie "serie", e.crtl_anio "anio",
              e.crtl_usuario_crea "usuarioCrea", TO_CHAR(e.crtl_fecha_crea, 'YYYY-MM-DD') "fechaCrea",
              e.crtl_usuario_mod "usuarioMod", TO_CHAR(e.crtl_fecha_mod, 'YYYY-MM-DD') "fechaMod",
              NVL(u.det_deprecia_acum, 0) "depreciacionAcumulada", u.det_valor_libros "valorLibros",
              (SELECT COUNT(*) FROM depreciaciones.dep_detctrl_depreciacion x WHERE x.det_codcrtl = e.crtl_correlativo) "mesesGenerados",
              (SELECT COUNT(*) FROM depreciaciones.dep_porcanterior_depreciacion p WHERE p.por_codcrtl = e.crtl_correlativo) tiene_otro
         FROM depreciaciones.dep_control_depreciacion e
         JOIN depreciaciones.dep_detrel_cuentas a ON a.rel_codigo = e.crtl_codrel_cta
         JOIN depreciaciones.dep_cuenta b ON b.cta_codigo = a.rel_codcta
         JOIN depreciaciones.dep_sub_cuenta c ON c.sub_correla = a.rel_codsub
         LEFT JOIN depreciaciones.dep_sub_div_cuenta d ON d.div_correla = a.rel_coddiv
         LEFT JOIN depreciaciones.dep_detctrl_depreciacion u
                ON u.det_codcrtl = e.crtl_correlativo
               AND u.det_correlativo = (SELECT MAX(m.det_correlativo) FROM depreciaciones.dep_detctrl_depreciacion m
                                         WHERE m.det_codcrtl = e.crtl_correlativo)
        WHERE e.crtl_correlativo = :correlativo`,
      { correlativo },
    );
    if (!rows[0]) return null;
    const { TIENE_OTRO, ...activo } = rows[0];
    return { ...activo, tieneOtroPorcentaje: TIENE_OTRO > 0 };
  }

  detalle(correlativo: number): Promise<DetalleDepreciacion[]> {
    return this.db.query<DetalleDepreciacion>(
      `SELECT det_correlativo "correlativo", det_codper "periodo", TRIM(det_descripcion) "descripcion",
              det_saldo_inicial "saldoInicial", det_factor "factor", det_deprecia_mes "depreciacionMes",
              det_deprecia_acum "depreciacionAcumulada", det_valor_libros "valorLibros",
              det_observaciones "observaciones"
         FROM depreciaciones.dep_detctrl_depreciacion
        WHERE det_codcrtl = :correlativo
        ORDER BY det_correlativo`,
      { correlativo },
    );
  }

  otrosPorcentajes(correlativo: number): Promise<OtroPorcentaje[]> {
    return this.db.query<OtroPorcentaje>(
      `SELECT por_correlativo "correlativo",
              TO_CHAR(por_fecha_inicio, 'YYYY-MM-DD') "fechaInicio", TO_CHAR(por_fecha_final, 'YYYY-MM-DD') "fechaFinal",
              por_valor_original "valorOriginal", por_valor_mensual "valorMensual", por_factor "factor"
         FROM depreciaciones.dep_porcanterior_depreciacion
        WHERE por_codcrtl = :correlativo
        ORDER BY por_correlativo`,
      { correlativo },
    );
  }

  /** El periodo del mes debe existir y empezar el día 1; si no, el procedimiento no genera nada. */
  async existePeriodoQueIniciaEl(primerDia: string): Promise<boolean> {
    const r = await this.db.query<{ N: number }>(
      `SELECT COUNT(*) n FROM depreciaciones.dep_per_periodo WHERE TRUNC(per_fecha_inicio) = TO_DATE(:primerDia, 'YYYY-MM-DD')`,
      { primerDia },
    );
    return r[0]?.N === 1;
  }

  /**
   * Inserta el activo y genera su depreciación en la MISMA transacción: el procedimiento hace COMMIT
   * (confirma ambos) o ROLLBACK (descarta ambos). Java confirmaba el activo antes de generar, y si la
   * generación fallaba quedaba un activo sin depreciación.
   */
  crear(
    datos: DatosActivo & { relacion: number; valorMensual: number; factor: number },
    usuario: string,
  ): Promise<{ correlativo: number; clave: string }> {
    return this.db.transaction(async (conn) => {
      const r = await conn.execute<{ N: number }>(
        `SELECT NVL(MAX(crtl_correlativo), 0) + 1 n FROM depreciaciones.dep_control_depreciacion`,
        {},
        OBJ,
      );
      const correlativo = r.rows![0].N;
      await conn.execute(
        `INSERT INTO depreciaciones.dep_control_depreciacion
                (crtl_correlativo, crtl_codrel_cta, crtl_descripcion, crtl_no_tarjeta, crtl_cuenta_ppto,
                 crtl_fecha_inicio, crtl_valor_original, crtl_valor_mensual, crtl_factor, crtl_estado,
                 crtl_no_constancia, crtl_fecha_constancia, crtl_no_cur, crtl_usuario_crea, crtl_fecha_crea,
                 crtl_marca, crtl_modelo, crtl_serie, crtl_anio)
         VALUES (:correlativo, :relacion, UPPER(:descripcion), :tarjeta, :cuentaPresupuesto,
                 TO_DATE(:fechaInicio, 'YYYY-MM-DD'), :valorOriginal, :valorMensual, :factor, 'A',
                 UPPER(:noConstancia), TO_DATE(:fechaConstancia, 'YYYY-MM-DD'), UPPER(:noCur), :usuario, SYSDATE,
                 UPPER(:marca), UPPER(:modelo), UPPER(:serie), :anio)`,
        {
          correlativo,
          relacion: datos.relacion,
          descripcion: datos.descripcion,
          tarjeta: datos.tarjeta,
          cuentaPresupuesto: datos.cuentaPresupuesto,
          fechaInicio: datos.fechaInicio,
          valorOriginal: datos.valorOriginal,
          valorMensual: datos.valorMensual,
          factor: datos.factor,
          noConstancia: datos.noConstancia,
          fechaConstancia: datos.fechaConstancia,
          noCur: datos.noCur,
          usuario,
          marca: datos.marca,
          modelo: datos.modelo,
          serie: datos.serie,
          anio: datos.anio,
        },
      );
      const clave = await this.generar(conn, 'dep_generacion_mes', usuario, correlativo, datos.fechaInicio);
      return { correlativo, clave };
    });
  }

  /** UPDATE de los datos del activo (Java lo armaba concatenando texto). No toca el detalle. */
  async actualizar(
    correlativo: number,
    datos: DatosActivo & { estado: EstadoActivo; valorMensual: number; factor: number },
    usuario: string,
  ): Promise<number> {
    const r = await this.db.execute(
      `UPDATE depreciaciones.dep_control_depreciacion
          SET crtl_descripcion = UPPER(:descripcion), crtl_no_tarjeta = UPPER(:tarjeta),
              crtl_cuenta_ppto = :cuentaPresupuesto, crtl_fecha_inicio = TO_DATE(:fechaInicio, 'YYYY-MM-DD'),
              crtl_valor_original = :valorOriginal, crtl_valor_mensual = :valorMensual, crtl_factor = :factor,
              crtl_estado = :estado, crtl_no_constancia = UPPER(:noConstancia),
              crtl_fecha_constancia = TO_DATE(:fechaConstancia, 'YYYY-MM-DD'), crtl_no_cur = UPPER(:noCur),
              crtl_usuario_mod = :usuario, crtl_fecha_mod = SYSDATE,
              crtl_marca = UPPER(:marca), crtl_modelo = UPPER(:modelo), crtl_serie = UPPER(:serie), crtl_anio = :anio
        WHERE crtl_correlativo = :correlativo`,
      {
        descripcion: datos.descripcion,
        tarjeta: datos.tarjeta,
        cuentaPresupuesto: datos.cuentaPresupuesto,
        fechaInicio: datos.fechaInicio,
        valorOriginal: datos.valorOriginal,
        valorMensual: datos.valorMensual,
        factor: datos.factor,
        estado: datos.estado,
        noConstancia: datos.noConstancia,
        fechaConstancia: datos.fechaConstancia,
        noCur: datos.noCur,
        usuario,
        marca: datos.marca,
        modelo: datos.modelo,
        serie: datos.serie,
        anio: datos.anio,
        correlativo,
      },
    );
    return r.rowsAffected ?? 0;
  }

  /**
   * Borra el detalle, deja el activo en estado A y lo vuelve a generar, todo en una transacción.
   * Java borraba y confirmaba primero: si la generación fallaba, el activo quedaba sin detalle.
   */
  regenerar(
    correlativo: number,
    procedimiento: ProcedimientoGeneracion,
    fechaDesde: string,
    usuario: string,
  ): Promise<string> {
    return this.db.transaction(async (conn) => {
      await conn.execute(`DELETE FROM depreciaciones.dep_detctrl_depreciacion WHERE det_codcrtl = :correlativo`, {
        correlativo,
      });
      await conn.execute(
        `UPDATE depreciaciones.dep_control_depreciacion
            SET crtl_estado = 'A', crtl_fecha_final = NULL
          WHERE crtl_correlativo = :correlativo`,
        { correlativo },
      );
      return this.generar(conn, procedimiento, usuario, correlativo, fechaDesde);
    });
  }

  /** DEP_PORCANTERIOR_DEPRECIACION no tiene llave primaria; Java siempre usaba correlativo 1. */
  async insertarOtroPorcentaje(
    correlativo: number,
    o: Omit<OtroPorcentaje, 'correlativo'> & { fechaInicio: string; fechaFinal: string },
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO depreciaciones.dep_porcanterior_depreciacion
              (por_codcrtl, por_correlativo, por_valor_original, por_valor_mensual, por_factor,
               por_fecha_inicio, por_fecha_final)
       VALUES (:correlativo, 1, :valorOriginal, :valorMensual, :factor,
               TO_DATE(:fechaInicio, 'YYYY-MM-DD'), TO_DATE(:fechaFinal, 'YYYY-MM-DD'))`,
      {
        correlativo,
        valorOriginal: o.valorOriginal,
        valorMensual: o.valorMensual,
        factor: o.factor,
        fechaInicio: o.fechaInicio,
        fechaFinal: o.fechaFinal,
      },
    );
  }

  /**
   * Llama al procedimiento de generación dentro de la transacción abierta y devuelve P_CLAVE.
   * Si no devuelve '0' se lanza un error para que DatabaseService.transaction haga ROLLBACK.
   */
  private async generar(
    conn: oracledb.Connection,
    procedimiento: ProcedimientoGeneracion,
    usuario: string,
    correlativo: number,
    fecha: string,
  ): Promise<string> {
    const r = await conn.execute<unknown>(
      `BEGIN depreciaciones.${procedimiento}(:usuario, :correlativo, TO_DATE(:fecha, 'YYYY-MM-DD'), :clave); END;`,
      {
        usuario,
        correlativo,
        fecha: `${fecha.slice(0, 7)}-01`,
        clave: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 2000 },
      },
    );
    const clave = ((r.outBinds as { clave: string | null }).clave ?? '').trim();
    if (clave !== '0') throw new ErrorGeneracion(clave);
    return clave;
  }
}

/** El procedimiento de generación devolvió un código de error en P_CLAVE. */
export class ErrorGeneracion extends Error {
  constructor(readonly clave: string) {
    super(`El procedimiento de depreciación devolvió: ${clave}`);
  }
}
