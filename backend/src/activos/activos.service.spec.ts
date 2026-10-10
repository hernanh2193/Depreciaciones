import { BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { BitacoraService } from '../bitacora/bitacora.service.js';
import { ErrorGeneracion, type ActivosRepository } from './activos.repository.js';
import { ActivosService } from './activos.service.js';
import type { Activo } from './activos.types.js';

const ACTIVO: Activo = {
  correlativo: 3064,
  relacionCodigo: 30,
  cuenta: '1232 - MAQUINARIA',
  subCuenta: '4 - EQUIPO',
  division: 'SIN DIVISIÓN',
  porcentaje: 20,
  descripcion: 'COMPRESOR',
  tarjeta: '531',
  cuentaPresupuesto: 316,
  fechaInicio: '2025-12-12',
  fechaFinal: null,
  valorOriginal: 89588.39,
  valorMensual: 1493.15,
  factor: 0.016667,
  estado: 'A',
  noConstancia: '2855',
  fechaConstancia: '2025-12-12',
  noCur: 'RGS: 11723',
  marca: null,
  modelo: null,
  serie: null,
  anio: null,
  usuarioCrea: 'u',
  fechaCrea: '2025-12-12',
  usuarioMod: null,
  fechaMod: null,
  depreciacionAcumulada: 1493.15,
  valorLibros: 88095.24,
  mesesGenerados: 10,
  tieneOtroPorcentaje: false,
};

const DATOS = {
  descripcion: 'COMPRESOR',
  tarjeta: '531',
  cuentaPresupuesto: 316,
  fechaInicio: '2025-12-12',
  valorOriginal: 89588.39,
  noConstancia: null,
  fechaConstancia: null,
  noCur: null,
  marca: null,
  modelo: null,
  serie: null,
  anio: null,
};

function crear(repoParcial: Record<string, unknown> = {}) {
  const repo = {
    porcentajeRelacion: vi.fn().mockResolvedValue(20),
    existePeriodoQueIniciaEl: vi.fn().mockResolvedValue(true),
    crear: vi.fn().mockResolvedValue({ correlativo: 3065, clave: '0' }),
    obtener: vi.fn().mockResolvedValue(ACTIVO),
    actualizar: vi.fn().mockResolvedValue(1),
    regenerar: vi.fn().mockResolvedValue('0'),
    otrosPorcentajes: vi.fn().mockResolvedValue([]),
    insertarOtroPorcentaje: vi.fn().mockResolvedValue(undefined),
    ...repoParcial,
  };
  const bitacora = { registrar: vi.fn() };
  return { service: new ActivosService(repo as unknown as ActivosRepository, bitacora as unknown as BitacoraService), repo };
}

describe('ActivosService.crear', () => {
  it('calcula factor y valor mensual con el porcentaje de la relación y genera desde el día 1 del mes', async () => {
    const { service, repo } = crear();
    const res = await service.crear({ ...DATOS, relacion: 30 }, 'u');
    expect(res).toEqual({ correlativo: 3065, factor: 0.016667, valorMensual: 1493.15 });
    expect(repo.existePeriodoQueIniciaEl).toHaveBeenCalledWith('2025-12-01');
    expect(repo.crear).toHaveBeenCalledWith(expect.objectContaining({ factor: 0.016667, valorMensual: 1493.15, relacion: 30 }), 'u');
  });

  it('rechaza si no existe el periodo del mes de inicio (no se generaría depreciación)', async () => {
    const { service, repo } = crear({ existePeriodoQueIniciaEl: vi.fn().mockResolvedValue(false) });
    await expect(service.crear({ ...DATOS, fechaInicio: '2024-03-15', relacion: 30 }, 'u')).rejects.toThrow(
      'No existe un periodo que inicie el 01/03/2024',
    );
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('rechaza valores que darían valor mensual Q0.00 (división entre cero en el procedimiento)', async () => {
    const { service } = crear({ porcentajeRelacion: vi.fn().mockResolvedValue(2.5) });
    await expect(service.crear({ ...DATOS, valorOriginal: 2, relacion: 1 }, 'u')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('si el procedimiento falla, informa que el activo no se guardó', async () => {
    const { service } = crear({ crear: vi.fn().mockRejectedValue(new ErrorGeneracion(' -08 -1')) });
    await expect(service.crear({ ...DATOS, relacion: 30 }, 'u')).rejects.toThrow(InternalServerErrorException);
    await expect(service.crear({ ...DATOS, relacion: 30 }, 'u')).rejects.toThrow('El activo no se guardó');
  });

  it('relación inexistente responde 400', async () => {
    const { service } = crear({ porcentajeRelacion: vi.fn().mockResolvedValue(null) });
    await expect(service.crear({ ...DATOS, relacion: 999 }, 'u')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ActivosService.actualizar', () => {
  it('si no cambia el valor original conserva factor y valor mensual guardados', async () => {
    const especial = { ...ACTIVO, valorMensual: 176.16, factor: 0.016667 };
    const { service, repo } = crear({ obtener: vi.fn().mockResolvedValue(especial) });
    const res = await service.actualizar(3064, { ...DATOS, descripcion: 'OTRA', estado: 'A' }, 'u');
    expect(res).toEqual({ factor: 0.016667, valorMensual: 176.16, regenerarSugerido: false });
    expect(repo.actualizar).toHaveBeenCalledWith(3064, expect.objectContaining({ valorMensual: 176.16 }), 'u');
  });

  it('si cambia el valor original recalcula y sugiere regenerar', async () => {
    const { service } = crear();
    const res = await service.actualizar(3064, { ...DATOS, valorOriginal: 2550, estado: 'A' }, 'u');
    expect(res).toEqual({ factor: 0.016667, valorMensual: 42.48, regenerarSugerido: true });
  });

  it('recalcula si el factor guardado es 0 (activos afectados por el error del Enter en Java)', async () => {
    const roto = { ...ACTIVO, correlativo: 2827, valorOriginal: 46357.14, valorMensual: 0, factor: 0, mesesGenerados: 0 };
    const { service } = crear({ obtener: vi.fn().mockResolvedValue(roto) });
    const res = await service.actualizar(2827, { ...DATOS, valorOriginal: 46357.14, estado: 'A' }, 'u');
    expect(res.factor).toBe(0.016667);
    // (46357.14 - 1) x 0.016667 = 772.6178
    expect(res.valorMensual).toBe(772.62);
  });

  it('activo inexistente responde 404', async () => {
    const { service } = crear({ obtener: vi.fn().mockResolvedValue(null) });
    await expect(service.actualizar(1, { ...DATOS, estado: 'A' }, 'u')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ActivosService.regenerar', () => {
  it('regenera con DEP_GENERACION_MES desde la fecha de inicio', async () => {
    const { service, repo } = crear();
    await service.regenerar(3064, 'u');
    expect(repo.regenerar).toHaveBeenCalledWith(3064, 'dep_generacion_mes', '2025-12-12', 'u');
  });

  it('no regenera activos anulados', async () => {
    const { service, repo } = crear({ obtener: vi.fn().mockResolvedValue({ ...ACTIVO, estado: 'I' }) });
    await expect(service.regenerar(3064, 'u')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.regenerar).not.toHaveBeenCalled();
  });

  it('no regenera con el procedimiento normal si el activo tiene otro porcentaje', async () => {
    const { service, repo } = crear({ obtener: vi.fn().mockResolvedValue({ ...ACTIVO, tieneOtroPorcentaje: true }) });
    await expect(service.regenerar(3064, 'u')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.regenerar).not.toHaveBeenCalled();
  });

  it('si falla informa que el detalle anterior se conservó', async () => {
    const { service } = crear({ regenerar: vi.fn().mockRejectedValue(new ErrorGeneracion('-08')) });
    await expect(service.regenerar(3064, 'u')).rejects.toThrow('El detalle anterior se conservó');
  });
});

describe('ActivosService otros porcentajes', () => {
  const tramo = { valorOriginal: 1000, valorMensual: 5, factor: 0.005, fechaInicio: '2020-01-31', fechaFinal: '2022-02-28' };

  it('no permite un segundo tramo (Java siempre usaba correlativo 1)', async () => {
    const { service, repo } = crear({ otrosPorcentajes: vi.fn().mockResolvedValue([{ correlativo: 1 }]) });
    await expect(service.crearOtroPorcentaje(3064, tramo, 'u')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.insertarOtroPorcentaje).not.toHaveBeenCalled();
  });

  it('rechaza fecha final anterior a la inicial', async () => {
    const { service } = crear();
    await expect(
      service.crearOtroPorcentaje(3064, { ...tramo, fechaInicio: '2022-01-01', fechaFinal: '2021-01-01' }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('regenera con DEP_GENERACION_PORCANT desde el inicio del tramo', async () => {
    const { service, repo } = crear({ otrosPorcentajes: vi.fn().mockResolvedValue([{ ...tramo, correlativo: 1 }]) });
    await service.regenerarConOtroPorcentaje(3064, 'u');
    expect(repo.regenerar).toHaveBeenCalledWith(3064, 'dep_generacion_porcant', '2020-01-31', 'u');
  });
});
