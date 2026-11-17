import { BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { BitacoraService } from '../bitacora/bitacora.service.js';
import type { ActivoProceso, ProcesosRepository } from './procesos.repository.js';
import { ProcesosService } from './procesos.service.js';

const activo = (correlativo: number, categoria: ActivoProceso['categoria'], extra: Partial<ActivoProceso> = {}): ActivoProceso => ({
  correlativo,
  descripcion: 'X',
  fechaInicio: '2025-01-15',
  valorOriginal: 1000,
  valorMensual: 16.65,
  ultimoPeriodo: 202608,
  mesesGenerados: 10,
  mesesSalto: 0,
  ultimoMes: false,
  categoria,
  ...extra,
});

function crear(repoParcial: Record<string, unknown> = {}) {
  const repo = {
    existeCuenta: vi.fn().mockResolvedValue(true),
    periodo: vi.fn().mockResolvedValue({ codigo: 202609, estado: 'R', fechaInicio: '2026-09-01', fechaFinal: '2026-09-30' }),
    vista: vi.fn().mockResolvedValue([activo(1, 'NORMAL'), activo(2, 'NORMAL', { ultimoMes: true })]),
    conteo: vi
      .fn()
      .mockResolvedValueOnce({ filas: 100, depreciados: 50 })
      .mockResolvedValueOnce({ filas: 102, depreciados: 51 }),
    generar: vi.fn().mockResolvedValue('0'),
    ...repoParcial,
  };
  const bitacora = { registrar: vi.fn() };
  return { service: new ProcesosService(repo as unknown as ProcesosRepository, bitacora as unknown as BitacoraService), repo };
}

describe('ProcesosService.vista', () => {
  it('cuenta las categorías y los activos que terminan', async () => {
    const { service } = crear({
      vista: vi.fn().mockResolvedValue([
        activo(1, 'NORMAL', { ultimoMes: true }),
        activo(2, 'SALTO', { mesesSalto: 14 }),
        activo(3, 'SALTO', { mesesSalto: 3 }),
        activo(4, 'SIN_DETALLE', { ultimoPeriodo: null, mesesGenerados: 0 }),
      ]),
    });
    const v = await service.vista(1232, 202609);
    expect(v.totales).toEqual({ activos: 4, NORMAL: 1, SALTO: 2, SIN_DETALLE: 1, MENSUAL_CERO: 0, terminan: 1 });
    expect(v.bloqueos).toEqual([]);
    expect(v.advertencias).toHaveLength(2);
    expect(v.advertencias[0]).toContain('hasta 14 meses');
  });

  it('bloquea si hay activos con valor mensual 0 (el procedimiento fallaría para toda la cuenta)', async () => {
    const { service } = crear({ vista: vi.fn().mockResolvedValue([activo(1, 'NORMAL'), activo(2827, 'MENSUAL_CERO')]) });
    const v = await service.vista(1237, 202609);
    expect(v.bloqueos.join()).toContain('2827');
  });

  it('bloquea periodos que no están en estado R (Java solo aceptaba REGISTRADA)', async () => {
    const { service } = crear({ periodo: vi.fn().mockResolvedValue({ codigo: 202001, estado: 'P', fechaInicio: '', fechaFinal: '' }) });
    expect((await service.vista(1232, 202001)).bloqueos.join()).toContain('REGISTRADA');
  });

  it('cuenta o periodo inexistente responde 404', async () => {
    await expect(crear({ existeCuenta: vi.fn().mockResolvedValue(false) }).service.vista(9, 202609)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(crear({ periodo: vi.fn().mockResolvedValue(null) }).service.vista(1232, 209912)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ProcesosService.generar', () => {
  it('ejecuta y devuelve meses generados y activos terminados', async () => {
    const { service, repo } = crear();
    await expect(service.generar(1232, 202609, false, 'u')).resolves.toEqual({
      mesesGenerados: 2,
      activosTerminados: 1,
      esperados: 2,
    });
    expect(repo.generar).toHaveBeenCalledWith('u', 1232, 202609);
  });

  it('no ejecuta con bloqueos', async () => {
    const { service, repo } = crear({ vista: vi.fn().mockResolvedValue([activo(2827, 'MENSUAL_CERO')]) });
    await expect(service.generar(1237, 202609, true, 'u')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.generar).not.toHaveBeenCalled();
  });

  it('exige confirmar advertencias (saltos o activos sin detalle)', async () => {
    const { service, repo } = crear({ vista: vi.fn().mockResolvedValue([activo(1, 'SALTO', { mesesSalto: 5 })]) });
    await expect(service.generar(1232, 202609, false, 'u')).rejects.toThrow('Debe confirmar');
    expect(repo.generar).not.toHaveBeenCalled();
  });

  it('con advertencias confirmadas sí ejecuta', async () => {
    const { service, repo } = crear({ vista: vi.fn().mockResolvedValue([activo(1, 'SALTO', { mesesSalto: 5 })]) });
    await service.generar(1232, 202609, true, 'u');
    expect(repo.generar).toHaveBeenCalled();
  });

  it('error del procedimiento: informa que no se guardó nada', async () => {
    const { service } = crear({ generar: vi.fn().mockResolvedValue(' -07 -2 ORA-00001') });
    await expect(service.generar(1232, 202609, false, 'u')).rejects.toThrow(InternalServerErrorException);
  });

  it('excepción de Oracle (p. ej. división entre cero) incluye el código ORA', async () => {
    const err = Object.assign(new Error('ORA-01476: divisor is equal to zero'), { errorNum: 1476 });
    const { service } = crear({ generar: vi.fn().mockRejectedValue(err) });
    await expect(service.generar(1232, 202609, false, 'u')).rejects.toThrow('ORA-01476');
  });
});

describe('ProcesosService.validarPeriodo', () => {
  it('rechaza meses inválidos', () => {
    expect(() => ProcesosService.validarPeriodo(202613)).toThrow(BadRequestException);
    expect(() => ProcesosService.validarPeriodo(2026)).toThrow(BadRequestException);
    expect(() => ProcesosService.validarPeriodo(202609)).not.toThrow();
  });
});
