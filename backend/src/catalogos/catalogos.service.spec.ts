import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import type { BitacoraService } from '../bitacora/bitacora.service.js';
import type { CatalogosRepository } from './catalogos.repository.js';
import { CatalogosService, periodoDesdeMes } from './catalogos.service.js';

function crear(repoParcial: Partial<Record<keyof CatalogosRepository, unknown>> = {}) {
  const repo = {
    insertarCuenta: vi.fn().mockResolvedValue(undefined),
    insertarSubCuenta: vi.fn().mockResolvedValue('0'),
    insertarDivision: vi.fn().mockResolvedValue('0'),
    insertarRelacion: vi.fn().mockResolvedValue('0'),
    existeRelacion: vi.fn().mockResolvedValue(false),
    insertarPeriodo: vi.fn().mockResolvedValue(530),
    ...repoParcial,
  };
  const bitacora = { registrar: vi.fn() };
  const service = new CatalogosService(
    repo as unknown as CatalogosRepository,
    bitacora as unknown as BitacoraService,
  );
  return { service, repo, bitacora };
}

const oraError = (num: number) => Object.assign(new Error(`ORA-${String(num).padStart(5, '0')}: error`), { errorNum: num });

describe('periodoDesdeMes', () => {
  it('calcula código y fechas de un mes de 31 días', () => {
    expect(periodoDesdeMes('2026-10')).toEqual({ codigo: 202610, fechaInicio: '2026-10-01', fechaFinal: '2026-10-31' });
  });

  it('respeta febrero en año bisiesto y no bisiesto', () => {
    expect(periodoDesdeMes('2028-02').fechaFinal).toBe('2028-02-29');
    expect(periodoDesdeMes('2027-02').fechaFinal).toBe('2027-02-28');
  });

  it('calcula meses de 30 días', () => {
    expect(periodoDesdeMes('2026-11').fechaFinal).toBe('2026-11-30');
  });
});

describe('CatalogosService', () => {
  it('crea una cuenta y registra en bitácora', async () => {
    const { service, repo, bitacora } = crear();
    await service.crearCuenta({ codigo: 1240, descripcion: 'EDIFICIOS', porcentaje: 5 }, 'jperez');
    expect(repo.insertarCuenta).toHaveBeenCalledWith({ codigo: 1240, descripcion: 'EDIFICIOS', porcentaje: 5 }, 'jperez');
    expect(bitacora.registrar).toHaveBeenCalled();
  });

  it('cuenta con código repetido responde 409', async () => {
    const { service, bitacora } = crear({ insertarCuenta: vi.fn().mockRejectedValue(oraError(1)) });
    await expect(service.crearCuenta({ codigo: 1231, descripcion: 'X', porcentaje: 20 }, 'u')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(bitacora.registrar).not.toHaveBeenCalled();
  });

  it('otros errores de Oracle al crear cuenta no se ocultan', async () => {
    const err = oraError(12899);
    const { service } = crear({ insertarCuenta: vi.fn().mockRejectedValue(err) });
    await expect(service.crearCuenta({ codigo: 1, descripcion: 'X', porcentaje: 1 }, 'u')).rejects.toBe(err);
  });

  it('subcuenta: error devuelto por el procedimiento se convierte en 500 con mensaje claro', async () => {
    const { service } = crear({ insertarSubCuenta: vi.fn().mockResolvedValue('-02  -1: INSERT-1400 - ORA-01400: cannot insert NULL') });
    await expect(service.crearSubCuenta({ codigo: 1, descripcion: 'X', porcentaje: 5 }, 'u')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('relación duplicada se rechaza sin llamar al procedimiento', async () => {
    const { service, repo } = crear({ existeRelacion: vi.fn().mockResolvedValue(true) });
    await expect(service.crearRelacion({ cuenta: 1231, subCuenta: 5, division: null }, 'u')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.insertarRelacion).not.toHaveBeenCalled();
  });

  it('relación sin división envía null al procedimiento', async () => {
    const { service, repo } = crear();
    await service.crearRelacion({ cuenta: 1231, subCuenta: 5 }, 'u');
    expect(repo.insertarRelacion).toHaveBeenCalledWith(1231, 5, null, 'u');
  });

  it('relación con cuenta inexistente (ORA-02291) responde 400', async () => {
    const { service } = crear({ insertarRelacion: vi.fn().mockResolvedValue('-02 -1: INSERT-2291 - ORA-02291: integrity constraint violated') });
    await expect(service.crearRelacion({ cuenta: 9, subCuenta: 9 }, 'u')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea el periodo con fechas calculadas del mes', async () => {
    const { service, repo } = crear();
    const res = await service.crearPeriodo({ mes: '2027-02', estado: 'R' }, 'u');
    expect(res).toEqual({ codigo: 202702, fechaInicio: '2027-02-01', fechaFinal: '2027-02-28' });
    expect(repo.insertarPeriodo).toHaveBeenCalledWith(
      { codigo: 202702, fechaInicio: '2027-02-01', fechaFinal: '2027-02-28', estado: 'R' },
      'u',
    );
  });

  it('periodo existente responde 409', async () => {
    const { service } = crear({ insertarPeriodo: vi.fn().mockRejectedValue(oraError(1)) });
    await expect(service.crearPeriodo({ mes: '2026-10', estado: 'R' }, 'u')).rejects.toThrow('El periodo 202610 ya existe');
  });
});
