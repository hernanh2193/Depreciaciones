import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { BitacoraService } from '../bitacora/bitacora.service.js';
import { PdfService } from './pdf.service.js';
import type { ReportesRepository } from './reportes.repository.js';
import { limpiarLista, ReportesService } from './reportes.service.js';

const activo = {
  CORRELATIVO: 3064,
  SUBCUENTA: '6 - EQUIPOS VARIOS',
  DESCRIPCION: 'COMPRESOR DE AIRE',
  PCT: 20,
  VALOR: 89588.39,
  MENSUAL: 1493.15,
  FECHA_INICIO: '2025-12-12',
  TARJETA: '531',
  CUENTA_PPTO: 316,
  CONSTANCIA: '2855',
  ESTADO: 'A',
};

function crear(repoParcial: Record<string, unknown> = {}) {
  const repo = {
    cuentas: vi.fn().mockResolvedValue([]),
    relaciones: vi.fn().mockResolvedValue([]),
    existePeriodo: vi.fn().mockResolvedValue(true),
    catalogo: vi.fn().mockResolvedValue([{ RELACION: 1, CUENTA: '1231 - X', SUBCUENTA: '3 - Y', DIVISION: 'SIN DIVISIÓN', PCT: 5 }]),
    cabeceraRelacion: vi.fn().mockResolvedValue({ RELACION: 30, CTA_CODIGO: 1237, CUENTA: '1237 - OTROS', SUBCUENTA: '6 - EQUIPOS', DIVISION: 'SIN DIVISIÓN', PCT: 20 }),
    activos: vi.fn().mockResolvedValue([activo, { ...activo, CORRELATIVO: 3063, VALOR: 10.61 }]),
    cuenta: vi.fn().mockResolvedValue({ CODIGO: 1237, DESCRIPCION: 'OTROS ACTIVOS FIJOS', PCT: 20 }),
    cabeceraActivo: vi.fn().mockResolvedValue({
      CORRELATIVO: 3064, TARJETA: '531', TARJETA_CONTABLE: '1237.6', CUENTA_PPTO: 316,
      CUENTA_NOMBRE: 'OTROS ACTIVOS FIJOS', VALOR: 89588.39, PCT: 20, DESCRIPCION: 'COMPRESOR', ESTADO: 'A',
    }),
    detalleTarjeta: vi.fn().mockResolvedValue([
      { CORRELATIVO: 1, PERIODO: 202601, DESCRIPCION: 'ENERO', SALDO_INICIAL: 89588.39, FACTOR: 0.016667, DEPRECIA_MES: 1493.15, DEPRECIA_ACUM: 1493.15, VALOR_LIBROS: 88095.24, OBSERVACIONES: 'DEPRECIACION' },
    ]),
    acumuladoMensual: vi.fn().mockResolvedValue([{ CUENTA: '1237.6', NOMBRE: 'EQUIPOS', VALOR: 1000.1 }]),
    resumenPorCuenta: vi.fn().mockResolvedValue([{ CUENTA: '1237.6', NOMBRE: 'EQUIPOS', ORIGINAL: 5000, VALOR: 80 }]),
    resumenMensual: vi.fn().mockResolvedValue([{ CUENTA: '1237.6', NOMBRE: 'EQUIPOS', ANTERIOR: 0, INCREMENTO: ' 12.5, 30', FINALIZA: ' 4.1, (+2.5', ACTUAL: 120 }]),
    consolidado: vi.fn().mockResolvedValue([
      { CORRELATIVO: 1, DESCRIPCION: 'A', ACUM_ANT: 100, VALOR: 1000, MESES: Array(12).fill(10), ACUM_ACT: 220 },
    ]),
    ...repoParcial,
  };
  const bitacora = { registrar: vi.fn() };
  const service = new ReportesService(repo as unknown as ReportesRepository, new PdfService(), bitacora as unknown as BitacoraService);
  return { service, repo, bitacora };
}

const esPdf = (b: Buffer) => b.subarray(0, 5).toString() === '%PDF-' && b.length > 1000;

// El primer PDF carga las fuentes y puede tardar varios segundos
vi.setConfig({ testTimeout: 30_000 });

describe('ReportesService genera los 8 PDF', () => {
  it.each([
    ['catálogo de cuentas', (s: ReportesService) => s.catalogoCuentas('u')],
    ['relación de cuentas', (s: ReportesService) => s.relacionCuentas(30, 'u')],
    ['tarjeta auxiliar', (s: ReportesService) => s.tarjetaActivo(3064, 'u')],
    ['activos por cuenta', (s: ReportesService) => s.activosPorCuenta(1237, 'u')],
    ['acumulado mensual', (s: ReportesService) => s.acumuladoMensual(2026, 10, 'u')],
    ['resumen por cuenta', (s: ReportesService) => s.resumenPorCuenta(2026, 10, 1237, 'u')],
    ['resumen mensual', (s: ReportesService) => s.resumenMensual(2026, 10, 'u')],
    ['consolidación anual', (s: ReportesService) => s.consolidacionAnual(30, 2026, 'u')],
  ])('%s', async (_, generar) => {
    const { service, bitacora } = crear();
    const r = await generar(service);
    expect(esPdf(r.contenido)).toBe(true);
    expect(r.nombre).toMatch(/\.pdf$/);
    expect(bitacora.registrar).toHaveBeenCalled();
  });

  it('sin datos genera el PDF con un aviso (Java generaba uno vacío)', async () => {
    const { service } = crear({ acumuladoMensual: vi.fn().mockResolvedValue([]) });
    expect(esPdf((await service.acumuladoMensual(2026, 10, 'u')).contenido)).toBe(true);
  });
});

describe('ReportesService validaciones', () => {
  it('periodo inexistente responde 404', async () => {
    const { service } = crear({ existePeriodo: vi.fn().mockResolvedValue(false) });
    await expect(service.resumenMensual(2030, 1, 'u')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mes y año fuera de rango responden 400', async () => {
    const { service } = crear();
    await expect(service.acumuladoMensual(2026, 13, 'u')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.consolidacionAnual(30, 1900, 'u')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activo, cuenta y relación inexistentes responden 404', async () => {
    await expect(crear({ cabeceraActivo: vi.fn().mockResolvedValue(null) }).service.tarjetaActivo(1, 'u')).rejects.toBeInstanceOf(NotFoundException);
    await expect(crear({ cuenta: vi.fn().mockResolvedValue(null) }).service.activosPorCuenta(9, 'u')).rejects.toBeInstanceOf(NotFoundException);
    await expect(crear({ cabeceraRelacion: vi.fn().mockResolvedValue(null) }).service.relacionCuentas(999, 'u')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('consolidación consulta el año pedido (corrige el año-1 de Java)', async () => {
    const { service, repo } = crear();
    await service.consolidacionAnual(30, 2025, 'u');
    expect(repo.consolidado).toHaveBeenCalledWith(30, 2025);
  });
});

describe('limpiarLista (textos de MesIncremento / MesFinaliza)', () => {
  it('formatea montos separados por coma', () => {
    expect(limpiarLista(' 12.5, 30')).toBe('12.50, 30.00');
  });

  it('reconoce positivos sin coma y con el paréntesis final recortado por la función de Oracle', () => {
    expect(limpiarLista(' 4.1, (+2.5) (+1')).toBe('4.10, (+2.50), (+1.00)');
  });

  it('montos menores a 1 que Oracle devuelve sin cero', () => {
    expect(limpiarLista(' .5')).toBe('0.50');
  });

  it('"0" y nulo se muestran vacíos', () => {
    expect(limpiarLista('0')).toBe('');
    expect(limpiarLista(null)).toBe('');
  });
});
