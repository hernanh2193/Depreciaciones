import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

/** Subconjunto de tipos de pdfmake 0.3 que se usa aquí (el paquete es CommonJS sin tipos para la API de servidor). */
export type Contenido = Record<string, unknown> | string | Contenido[];
interface PdfMake {
  setFonts(f: Record<string, Record<string, string>>): void;
  setLocalAccessPolicy(cb: (ruta: string) => boolean): void;
  setUrlAccessPolicy(cb: (url: string) => boolean): void;
  createPdf(doc: Record<string, unknown>): { getBuffer(): Promise<Buffer> };
}

export type TamanoPagina = 'LETTER' | 'LEGAL';

export interface DefinicionReporte {
  /** Segunda línea del encabezado (Java usaba "GERENCIA FINANCIERA" o "DEPARTAMENTO DE CONTABILIDAD"). */
  dependencia: string;
  titulo: string;
  /** Líneas adicionales bajo el título (periodo, cuenta, "(EN QUETZALES)"...). */
  subtitulos?: string[];
  tamano: TamanoPagina;
  horizontal: boolean;
  contenido: Contenido[];
  usuario: string;
}

const AZUL = '#0b2e59';
const GRIS_RELLENO = '#e6e6e6';

/**
 * Genera los PDF de los reportes con pdfmake (JavaScript puro, sin Java ni programas externos).
 * Encabezado institucional con logo en cada página y pie con usuario, fecha de impresión y "Página X de Y".
 */
@Injectable()
export class PdfService implements OnModuleInit {
  private readonly logger = new Logger(PdfService.name);
  private readonly pdfmake: PdfMake;
  private readonly logo: string | null;

  constructor() {
    const require = createRequire(import.meta.url);
    this.pdfmake = require('pdfmake') as PdfMake;
    const fuentes = join(dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');
    const f = (n: string) => join(fuentes, n);
    this.pdfmake.setFonts({
      Roboto: {
        normal: f('Roboto-Regular.ttf'),
        bold: f('Roboto-Medium.ttf'),
        italics: f('Roboto-Italic.ttf'),
        bolditalics: f('Roboto-MediumItalic.ttf'),
      },
    });
    // Solo puede leer sus fuentes; nunca descargar recursos externos
    this.pdfmake.setLocalAccessPolicy((ruta) => resolve(ruta).startsWith(resolve(fuentes)));
    this.pdfmake.setUrlAccessPolicy(() => false);

    const rutaLogo = resolve(process.cwd(), 'assets', 'epq.png');
    this.logo = existsSync(rutaLogo) ? `data:image/png;base64,${readFileSync(rutaLogo).toString('base64')}` : null;
    if (!this.logo) this.logger.warn(`No se encontró el logo en ${rutaLogo}; los reportes saldrán sin logo`);
  }

  /** El primer PDF tarda varios segundos (carga de fuentes): se genera uno de prueba al arrancar el backend. */
  onModuleInit() {
    const t0 = Date.now();
    this.pdfmake
      .createPdf({ content: ['.'] })
      .getBuffer()
      .then(() => this.logger.log(`Generador de PDF listo (${Date.now() - t0} ms)`))
      .catch((err: Error) => this.logger.error(`No se pudo inicializar el generador de PDF: ${err.message}`));
  }

  async generar(def: DefinicionReporte, ahora = new Date()): Promise<Buffer> {
    const impreso = ahora.toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short', hour12: false });
    const doc = {
      pageSize: def.tamano,
      pageOrientation: def.horizontal ? 'landscape' : 'portrait',
      pageMargins: [30, 30 + 14 * (3 + (def.subtitulos?.length ?? 0)) + 20, 30, 40],
      info: { title: def.titulo, author: 'Empresa Portuaria Quetzal', creator: 'Sistema de Depreciaciones' },
      header: () => ({
        margin: [30, 22, 30, 0],
        columns: [
          this.logo ? { image: this.logo, width: 46 } : { text: '', width: 46 },
          {
            width: '*',
            alignment: 'center',
            stack: [
              { text: 'EMPRESA PORTUARIA QUETZAL', bold: true, fontSize: 13, color: AZUL },
              { text: def.dependencia, bold: true, fontSize: 10 },
              { text: def.titulo, bold: true, fontSize: 10, margin: [0, 2, 0, 0] },
              ...(def.subtitulos ?? []).map((s) => ({ text: s, fontSize: 9 })),
            ],
          },
          { text: '', width: 46 },
        ],
      }),
      footer: (actual: number, total: number) => ({
        margin: [30, 12, 30, 0],
        fontSize: 7,
        color: '#555555',
        columns: [
          { text: `Impreso por ${def.usuario} el ${impreso} · Sistema de Depreciaciones` },
          { text: `Página ${actual} de ${total}`, alignment: 'right' },
        ],
      }),
      content: def.contenido,
      defaultStyle: { font: 'Roboto', fontSize: 8 },
      styles: {
        rotulo: { bold: true, fillColor: GRIS_RELLENO, alignment: 'center', fontSize: 8 },
        grupo: { bold: true, fillColor: '#dbe7f6', color: AZUL },
        total: { bold: true, fillColor: '#f2f2f2' },
        dato: { fontSize: 9 },
      },
    };
    return this.pdfmake.createPdf(doc).getBuffer();
  }
}

/** Q 1,234.50 (siempre 2 decimales; Java mezclaba "1234.5", ".00" y "####"). */
export function q(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY'. */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** Fila de rótulos de una tabla. */
export const rotulos = (textos: string[]) => textos.map((t) => ({ text: t, style: 'rotulo' }));

/** Celda numérica alineada a la derecha. */
export const num = (n: number | null | undefined, extra: Record<string, unknown> = {}) => ({ text: q(n), alignment: 'right', ...extra });

/** Tabla con encabezado repetido en cada página y líneas horizontales suaves. */
export function tabla(widths: (number | string)[], encabezado: Contenido[], filas: Contenido[][], margen = [0, 6, 0, 0]) {
  return {
    margin: margen,
    table: { headerRows: 1, widths, body: [encabezado, ...filas], dontBreakRows: true },
    layout: {
      hLineWidth: (i: number) => (i <= 1 ? 0.8 : 0.3),
      vLineWidth: () => 0,
      hLineColor: () => '#9aa5b1',
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
  };
}

/** Mensaje en lugar de la tabla cuando no hay datos (Java generaba un PDF vacío sin avisar). */
export const sinDatos = (texto = 'No hay datos para los parámetros seleccionados.') => ({
  text: texto,
  italics: true,
  alignment: 'center',
  margin: [0, 30, 0, 0],
  color: '#555555',
});
