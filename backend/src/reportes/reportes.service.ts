import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { fecha, num, PdfService, q, rotulos, sinDatos, tabla, type Contenido } from './pdf.service.js';
import { ReportesRepository } from './reportes.repository.js';

export const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

const CONTABILIDAD = 'DEPARTAMENTO DE CONTABILIDAD';
const FINANCIERA = 'GERENCIA FINANCIERA';
const pct = (p: number | null | undefined) => (p === null || p === undefined ? '' : `${p.toLocaleString('es-GT', { maximumFractionDigits: 2 })} %`);
const suma = (xs: number[]) => Math.round(xs.reduce((s, x) => s + (x || 0), 0) * 100) / 100;
const filaTotal = (celdas: Contenido[]) => celdas.map((c) => (typeof c === 'string' ? { text: c, style: 'total' } : { ...(c as object), style: 'total' }));
const vacio = (n: number) => Array.from({ length: n }, () => ({ text: '', style: 'total' }));

/** Un PDF generado listo para enviar. */
export interface ArchivoPdf {
  nombre: string;
  contenido: Buffer;
}

/** Arma los 8 reportes PDF del menú REPORTES (Rep*Ctrl.java). */
@Injectable()
export class ReportesService {
  constructor(
    private readonly repo: ReportesRepository,
    private readonly pdf: PdfService,
    private readonly bitacora: BitacoraService,
  ) {}

  async opciones() {
    const [cuentas, relaciones] = await Promise.all([this.repo.cuentas(), this.repo.relaciones()]);
    return { cuentas, relaciones };
  }

  // 1. CATÁLOGO DE CUENTAS (RepCuentaRel) — carta vertical, sin parámetros
  async catalogoCuentas(usuario: string): Promise<ArchivoPdf> {
    const filas = await this.repo.catalogo();
    const contenido = filas.length
      ? [
          tabla(
            [35, '*', '*', '*', 40],
            rotulos(['COD.', 'CUENTA', 'SUBCUENTA', 'DIVISIÓN', '%']),
            filas.map((f) => [{ text: f.RELACION, alignment: 'center' }, f.CUENTA, f.SUBCUENTA, f.DIVISION, { text: pct(f.PCT), alignment: 'center' }]),
          ),
        ]
      : [sinDatos()];
    return this.emitir('catalogo-cuentas', usuario, {
      dependencia: CONTABILIDAD,
      titulo: 'RELACIÓN DE CUENTAS CONTABLES',
      tamano: 'LETTER',
      horizontal: false,
      contenido,
    });
  }

  // 2. RELACIÓN DE CUENTAS / ACTIVOS (RepRCuentaActivo) — oficio horizontal
  async relacionCuentas(relacion: number, usuario: string): Promise<ArchivoPdf> {
    const cab = await this.repo.cabeceraRelacion(relacion);
    if (!cab) throw new NotFoundException(`No existe la relación de cuentas ${relacion}`);
    const activos = await this.repo.activos({ relacion });
    const total = suma(activos.map((a) => a.VALOR));
    const contenido: Contenido[] = [
      datosCabecera([
        ['Relación No.', String(cab.RELACION)],
        ['Cuenta', cab.CUENTA],
        ['Subcuenta', cab.SUBCUENTA],
        ['División', cab.DIVISION],
        ['Porcentaje', pct(cab.PCT)],
        ['Total valor', `Q ${q(total)}`],
      ]),
      activos.length
        ? tabla(
            [95, 38, '*', 30, 62, 55, 48, 45, 45, 25],
            rotulos(['SUBCUENTA', 'NO. ACTIVO', 'DESCRIPCIÓN', '%', 'VALOR', 'VALOR MES', 'FECHA', 'COSTO', 'CUENTA', 'EDO']),
            [
              ...activos.map((a) => [
                a.SUBCUENTA,
                { text: a.CORRELATIVO, alignment: 'center' },
                a.DESCRIPCION,
                { text: pct(a.PCT), alignment: 'center' },
                num(a.VALOR),
                num(a.MENSUAL),
                { text: fecha(a.FECHA_INICIO), alignment: 'center' },
                { text: a.TARJETA ?? '', alignment: 'center' },
                { text: a.CUENTA_PPTO ?? '', alignment: 'center' },
                { text: a.ESTADO, alignment: 'center' },
              ]),
              filaTotal([{ text: `TOTAL (${activos.length} activos)`, colSpan: 4, alignment: 'right' }, '', '', '', num(total), num(suma(activos.map((a) => a.MENSUAL))), ...vacio(4)]),
            ],
          )
        : sinDatos('La relación no tiene activos (excluye anulados).'),
    ];
    return this.emitir(`relacion-cuentas-${relacion}`, usuario, {
      dependencia: FINANCIERA,
      titulo: 'REPORTE DE RELACIÓN CUENTA ACTIVOS',
      tamano: 'LEGAL',
      horizontal: true,
      contenido,
    });
  }

  // 3. TARJETA AUXILIAR DE CONTROL DE DEPRECIACIONES (RepActDeprecia) — oficio horizontal
  async tarjetaActivo(correlativo: number, usuario: string): Promise<ArchivoPdf> {
    const a = await this.repo.cabeceraActivo(correlativo);
    if (!a) throw new NotFoundException(`No existe el activo ${correlativo}`);
    const detalle = await this.repo.detalleTarjeta(correlativo);
    const contenido: Contenido[] = [
      datosCabecera([
        ['Activo No.', String(a.CORRELATIVO)],
        ['Sección de costos', a.TARJETA ?? ''],
        ['Tarjeta No.', a.TARJETA_CONTABLE],
        ['Cuenta No.', String(a.CUENTA_PPTO ?? '')],
        ['Nombre de la cuenta', a.CUENTA_NOMBRE],
        ['Precio de compra', `Q ${q(a.VALOR)}`],
        ['Depreciación anual', pct(a.PCT)],
        ['Valor residual', 'Q 1.00'],
        ['Estado', ({ A: 'ACTIVO', D: 'DEPRECIADO', I: 'ANULADO' } as Record<string, string>)[a.ESTADO] ?? a.ESTADO],
      ]),
      { text: [{ text: 'Artículo: ', bold: true }, a.DESCRIPCION], margin: [0, 2, 0, 4], fontSize: 8 },
      detalle.length
        ? tabla(
            [45, 65, 75, 55, 60, 70, 75, 75, '*'],
            rotulos([
              'MES / AÑO', 'DESCRIPCIÓN', 'SALDO INICIAL (Q)', 'DISMINUCIÓN (Q)', 'FACTOR DEPR. MENSUAL',
              'DEPRECIA MENSUAL (Q)', 'DEPRECIA ACUMULADA (Q)', 'VALOR EN LIBROS (Q)', 'OBSERVACIONES',
            ]),
            detalle.map((d) => [
              { text: `${String(d.PERIODO).slice(4)}/${String(d.PERIODO).slice(0, 4)}`, alignment: 'center' },
              d.DESCRIPCION ?? '',
              num(d.SALDO_INICIAL),
              num(0),
              { text: d.FACTOR?.toFixed(6) ?? '', alignment: 'right' },
              num(d.DEPRECIA_MES),
              num(d.DEPRECIA_ACUM),
              num(d.VALOR_LIBROS),
              d.OBSERVACIONES ?? '',
            ]),
          )
        : sinDatos('El activo no tiene depreciación generada.'),
    ];
    return this.emitir(`tarjeta-activo-${correlativo}`, usuario, {
      dependencia: FINANCIERA,
      titulo: 'TARJETA AUXILIAR DE CONTROL DE DEPRECIACIONES',
      tamano: 'LEGAL',
      horizontal: true,
      contenido,
    });
  }

  // 4. ACTIVOS POR CUENTA (RepXActivo) — oficio horizontal
  async activosPorCuenta(cuenta: number, usuario: string): Promise<ArchivoPdf> {
    const c = await this.repo.cuenta(cuenta);
    if (!c) throw new NotFoundException(`No existe la cuenta ${cuenta}`);
    const activos = await this.repo.activos({ cuenta });
    const total = suma(activos.map((a) => a.VALOR));
    const contenido: Contenido[] = [
      datosCabecera([
        ['Cuenta No.', String(c.CODIGO)],
        ['Nombre de la cuenta', c.DESCRIPCION],
        ['Porcentaje', pct(c.PCT)],
        ['Total valor', `Q ${q(total)}`],
      ]),
      activos.length
        ? tabla(
            [110, 38, '*', 30, 65, 50, 70, 50, 45],
            rotulos(['SUBCUENTA', 'NO. ACTIVO', 'DESCRIPCIÓN', '%', 'VALOR', 'FECHA', 'NO. CONSTANCIA', 'COSTO', 'CUENTA']),
            [
              ...activos.map((a) => [
                a.SUBCUENTA,
                { text: a.CORRELATIVO, alignment: 'center' },
                a.DESCRIPCION,
                { text: pct(a.PCT), alignment: 'center' },
                num(a.VALOR),
                { text: fecha(a.FECHA_INICIO), alignment: 'center' },
                { text: a.CONSTANCIA ?? '', alignment: 'center' },
                { text: a.TARJETA ?? '', alignment: 'center' },
                { text: a.CUENTA_PPTO ?? '', alignment: 'center' },
              ]),
              filaTotal([{ text: `TOTAL (${activos.length} activos)`, colSpan: 4, alignment: 'right' }, '', '', '', num(total), ...vacio(4)]),
            ],
          )
        : sinDatos('La cuenta no tiene activos (excluye anulados).'),
    ];
    return this.emitir(`activos-cuenta-${cuenta}`, usuario, {
      dependencia: FINANCIERA,
      titulo: 'REPORTE DE ACTIVOS POR CUENTA',
      tamano: 'LEGAL',
      horizontal: true,
      contenido,
    });
  }

  // 5. ACUMULADO MENSUAL (RepDepreciaMes) — carta vertical
  async acumuladoMensual(anio: number, mes: number, usuario: string): Promise<ArchivoPdf> {
    const periodo = await this.validarPeriodo(anio, mes);
    const filas = await this.repo.acumuladoMensual(periodo);
    const contenido = filas.length
      ? [
          tabla(
            [70, '*', 110],
            rotulos(['CUENTA NO.', 'NOMBRE DE LA CUENTA', 'VALORES']),
            [
              ...filas.map((f) => [{ text: f.CUENTA, alignment: 'center' }, f.NOMBRE, num(f.VALOR)]),
              filaTotal([{ text: 'TOTAL', colSpan: 2, alignment: 'right' }, '', num(suma(filas.map((f) => f.VALOR)))]),
            ],
          ),
        ]
      : [sinDatos(`No hay depreciación generada para ${MESES[mes - 1]} ${anio}.`)];
    return this.emitir(`acumulado-mensual-${periodo}`, usuario, {
      dependencia: CONTABILIDAD,
      titulo: `DEPRECIACIÓN ACUMULADA, CORRESPONDIENTE AL MES DE ${MESES[mes - 1]} ${anio}`,
      subtitulos: ['(EN QUETZALES)'],
      tamano: 'LETTER',
      horizontal: false,
      contenido,
    });
  }

  // 6. RESUMEN POR CUENTA MENSUAL (RepResXCuenta) — carta vertical
  async resumenPorCuenta(anio: number, mes: number, cuenta: number, usuario: string): Promise<ArchivoPdf> {
    const periodo = await this.validarPeriodo(anio, mes);
    const c = await this.repo.cuenta(cuenta);
    if (!c) throw new NotFoundException(`No existe la cuenta ${cuenta}`);
    const filas = await this.repo.resumenPorCuenta(periodo, cuenta);
    const contenido = filas.length
      ? [
          tabla(
            [60, '*', 100, 90],
            rotulos(['CUENTA', 'NOMBRE', 'VALOR', 'DEPRECIACIÓN DEL MES']),
            [
              ...filas.map((f) => [{ text: f.CUENTA, alignment: 'center' }, f.NOMBRE, num(f.ORIGINAL), num(f.VALOR)]),
              filaTotal([
                { text: 'TOTAL', colSpan: 2, alignment: 'right' },
                '',
                num(suma(filas.map((f) => f.ORIGINAL ?? 0))),
                num(suma(filas.map((f) => f.VALOR))),
              ]),
            ],
          ),
        ]
      : [sinDatos(`No hay depreciación generada de la cuenta ${cuenta} para ${MESES[mes - 1]} ${anio}.`)];
    return this.emitir(`resumen-cuenta-${cuenta}-${periodo}`, usuario, {
      dependencia: CONTABILIDAD,
      titulo: `RESUMEN MENSUAL, CORRESPONDIENTE AL MES DE ${MESES[mes - 1]} ${anio}`,
      subtitulos: [`CUENTA ${c.CODIGO} - ${c.DESCRIPCION}`, '(EN QUETZALES)'],
      tamano: 'LETTER',
      horizontal: false,
      contenido,
    });
  }

  // 7. RESUMEN DE DEPRECIACIÓN MENSUAL (RepResumen) — carta vertical
  async resumenMensual(anio: number, mes: number, usuario: string): Promise<ArchivoPdf> {
    const periodo = await this.validarPeriodo(anio, mes);
    const filas = await this.repo.resumenMensual(periodo);
    const contenido = filas.length
      ? [
          tabla(
            [42, '*', 72, 80, 80, 72],
            rotulos(['NO.', 'CUENTA', 'SALDO ANTERIOR', 'INCREMENTO', 'FINALIZA', 'TOTAL']),
            [
              ...filas.map((f) => [
                { text: f.CUENTA, alignment: 'center' },
                f.NOMBRE,
                num(f.ANTERIOR),
                { text: limpiarLista(f.INCREMENTO), alignment: 'right', fontSize: 7 },
                { text: limpiarLista(f.FINALIZA), alignment: 'right', fontSize: 7 },
                num(f.ACTUAL),
              ]),
              filaTotal([
                { text: 'TOTALES', colSpan: 2, alignment: 'right' },
                '',
                num(suma(filas.map((f) => f.ANTERIOR))),
                '',
                '',
                num(suma(filas.map((f) => f.ACTUAL))),
              ]),
            ],
          ),
          {
            text: 'INCREMENTO: depreciación del primer mes de los activos que inician. FINALIZA: diferencia del último mes de los activos que terminan; (+) indica un ajuste a favor.',
            fontSize: 7,
            color: '#555555',
            margin: [0, 6, 0, 0],
          },
        ]
      : [sinDatos(`No hay depreciación generada para ${MESES[mes - 1]} ${anio}.`)];
    return this.emitir(`resumen-mensual-${periodo}`, usuario, {
      dependencia: CONTABILIDAD,
      titulo: `RESUMEN DE DEPRECIACIONES, CORRESPONDIENTE AL MES DE ${MESES[mes - 1]} ${anio}`,
      subtitulos: ['(EN QUETZALES)'],
      tamano: 'LETTER',
      horizontal: false,
      contenido,
    });
  }

  // 8. CONSOLIDACIÓN POR AÑO (RepConsolidaAcum) — oficio horizontal
  async consolidacionAnual(relacion: number, anio: number, usuario: string): Promise<ArchivoPdf> {
    validarAnio(anio);
    const cab = await this.repo.cabeceraRelacion(relacion);
    if (!cab) throw new NotFoundException(`No existe la relación de cuentas ${relacion}`);
    const filas = await this.repo.consolidado(relacion, anio);
    const abrev = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const contenido = filas.length
      ? [
          {
            fontSize: 6.5,
            ...tabla(
              [26, '*', 52, 52, ...abrev.map(() => 40), 52],
              rotulos(['NO', 'DESCRIPCIÓN', `ACUM. AL 31/12/${anio - 1}`, 'VALOR', ...abrev, `ACUM. AL 31/12/${anio}`]),
              [
                ...filas.map((f) => [
                  { text: f.CORRELATIVO, alignment: 'center' },
                  { text: f.DESCRIPCION, fontSize: 6 },
                  num(f.ACUM_ANT),
                  num(f.VALOR),
                  ...f.MESES.map((m) => num(m)),
                  num(f.ACUM_ACT),
                ]),
                filaTotal([
                  { text: 'TOTALES', colSpan: 2, alignment: 'right' },
                  '',
                  num(suma(filas.map((f) => f.ACUM_ANT))),
                  num(suma(filas.map((f) => f.VALOR))),
                  ...abrev.map((_, i) => num(suma(filas.map((f) => f.MESES[i])))),
                  num(suma(filas.map((f) => f.ACUM_ACT))),
                ]),
              ],
            ),
          },
        ]
      : [sinDatos(`La relación ${relacion} no tiene depreciación en ${anio}.`)];
    return this.emitir(`consolidacion-${relacion}-${anio}`, usuario, {
      dependencia: CONTABILIDAD,
      titulo: `DEPRECIACIÓN ANUAL POR RELACIÓN DE CUENTA, CORRESPONDIENTE AL AÑO ${anio}`,
      subtitulos: [`RELACIÓN ${cab.RELACION}: ${cab.CUENTA} / ${cab.SUBCUENTA} / ${cab.DIVISION}`, '(EN QUETZALES)'],
      tamano: 'LEGAL',
      horizontal: true,
      contenido,
    });
  }

  // ---------- comunes ----------

  private async validarPeriodo(anio: number, mes: number): Promise<number> {
    validarAnio(anio);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new BadRequestException('Mes no válido');
    const periodo = anio * 100 + mes;
    if (!(await this.repo.existePeriodo(periodo))) throw new NotFoundException(`No existe el periodo ${MESES[mes - 1]} ${anio}`);
    return periodo;
  }

  private async emitir(
    nombre: string,
    usuario: string,
    def: Omit<Parameters<PdfService['generar']>[0], 'usuario'>,
  ): Promise<ArchivoPdf> {
    const contenido = await this.pdf.generar({ ...def, usuario });
    this.bitacora.registrar(usuario, 'Reportes', `Reporte ${nombre}`);
    return { nombre: `${nombre}.pdf`, contenido };
  }
}

function validarAnio(anio: number) {
  if (!Number.isInteger(anio) || anio < 1980 || anio > 2100) throw new BadRequestException('Año no válido');
}

/** Bloque de datos del encabezado en dos columnas de "etiqueta: valor" (Java los subrayaba con espacios). */
function datosCabecera(pares: [string, string][]): Contenido {
  const mitad = Math.ceil(pares.length / 2);
  const columna = (ps: [string, string][]) => ({
    width: '*',
    stack: ps.map(([e, v]) => ({ text: [{ text: `${e}: `, bold: true }, v], margin: [0, 1, 0, 1] })),
  });
  return { columns: [columna(pares.slice(0, mitad)), columna(pares.slice(mitad))], columnGap: 20, fontSize: 8, margin: [0, 0, 0, 4] };
}

/**
 * Los textos de MesIncremento/MesFinaliza vienen como " 12.5, 30" o " 4.1, (+2.5) (+1" (los positivos de MesFinaliza
 * van sin coma y la función recorta el último carácter, que puede ser el paréntesis). Se reconoce cada número por su
 * forma y se muestra con 2 decimales; "(+x)" indica un ajuste a favor.
 */
export function limpiarLista(texto: string | null): string {
  if (!texto || texto.trim() === '0') return '';
  const partes = [...texto.matchAll(/(\(\+)?\s*(\d+(?:\.\d+)?|\.\d+)/g)].map(([, positivo, n]) =>
    positivo ? `(+${q(Number(n))})` : q(Number(n)),
  );
  return partes.join(', ');
}
