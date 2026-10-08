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
  trasladadoA: null,
  observacion: null,
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
  mesProcesoAjuste: null,
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
    periodosDelMesDeProceso: vi.fn().mockResolvedValue({ porFechaFinal: 1, queIniciaElDia1: 1 }),
    infoTraslado: vi.fn().mockResolvedValue({ mesesGenerados: 10, ultimoPeriodo: 202610, siguientePeriodo: 202611 }),
    empleado: vi.fn().mockResolvedValue({ codigo: 1234, nombre: 'X' }),
    trasladar: vi.fn().mockResolvedValue(3065),
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
    expect(repo.crear).toHaveBeenCalledWith(
      expect.objectContaining({ factor: 0.016667, valorMensual: 1493.15, relacion: 30 }),
      'u',
      null,
    );
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

describe('ActivosService.crear con ajuste (DEP_GENERACION_DEPRE_AJUSTE2)', () => {
  const HOY = new Date(2026, 9, 8); // 8 de octubre de 2026
  const conAjuste = (mes: string, extra = {}) => ({ ...DATOS, relacion: 30, fechaInicio: '2024-01-15', mesProcesoAjuste: mes, ...extra });

  it('calcula los meses atrasados y llama al ajuste con el mes de proceso', async () => {
    const { service, repo } = crear({ obtener: vi.fn().mockResolvedValue({ ...ACTIVO, mesesGenerados: 1 }) });
    const res = await service.crear(conAjuste('2026-10'), 'u', HOY);
    // Feb-2024 .. Oct-2026 = 33 meses
    expect(res).toMatchObject({ ajuste: { meses: 33, monto: Math.round(33 * 1493.15 * 100) / 100, mesProceso: '2026-10' } });
    expect(repo.crear).toHaveBeenCalledWith(expect.any(Object), 'u', '2026-10');
    expect(repo.existePeriodoQueIniciaEl).not.toHaveBeenCalled();
  });

  it('rechaza mes de proceso igual o anterior al de inicio (el procedimiento no insertaría nada)', async () => {
    const { service, repo } = crear();
    await expect(service.crear(conAjuste('2024-01'), 'u', HOY)).rejects.toThrow('posterior al mes de inicio');
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('rechaza mes de proceso futuro', async () => {
    const { service } = crear();
    await expect(service.crear(conAjuste('2026-11'), 'u', HOY)).rejects.toThrow('no puede ser futuro');
  });

  it('rechaza si el ajuste supera el valor depreciable', async () => {
    const { service } = crear();
    await expect(service.crear(conAjuste('2026-10', { fechaInicio: '2015-01-01' }), 'u', HOY)).rejects.toThrow(
      'supera el valor depreciable',
    );
  });

  it('rechaza si el periodo del mes de proceso tiene fechas incorrectas (p. ej. 202610 con final en 2029)', async () => {
    const { service } = crear({ periodosDelMesDeProceso: vi.fn().mockResolvedValue({ porFechaFinal: 0, queIniciaElDia1: 1 }) });
    await expect(service.crear(conAjuste('2026-10'), 'u', HOY)).rejects.toThrow('no existe o tiene fechas incorrectas');
  });

  it('detecta cuando AJUSTE2 responde OK pero AJUSTE3 revirtió todo', async () => {
    const { service } = crear({ obtener: vi.fn().mockResolvedValue(null) });
    await expect(service.crear(conAjuste('2026-10'), 'u', HOY)).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});

describe('ActivosService traslado (DEP_GENERACION_TRASLADO)', () => {
  const doc = { relacion: 28, tipo: 1 as const, documento: 'OF-1', fecha: '2026-10-08', autoriza: 1234, motivo: 'Cambio de cuenta' };

  it('vista previa con las fórmulas del procedimiento', async () => {
    const { service } = crear();
    const v = await service.vistaTraslado(3064, 28);
    expect(v).toEqual({
      porcentaje: 20,
      factor: 0.016667,
      valorMensual: 1493.15,
      meses: 11,
      depreciacionAcumulada: 16424.65,
      valorLibros: 73163.74,
      periodo: 202611,
    });
  });

  it('traslada y devuelve el activo nuevo', async () => {
    const { service, repo } = crear();
    await expect(service.trasladar(3064, doc, 'u')).resolves.toEqual({ activoNuevo: 3065 });
    expect(repo.trasladar).toHaveBeenCalledWith(3064, 28, doc, 'u');
  });

  it('no traslada activos que no están en estado A (el procedimiento respondería OK sin hacer nada)', async () => {
    const { service, repo } = crear({ obtener: vi.fn().mockResolvedValue({ ...ACTIVO, estado: 'D', trasladadoA: 3070 }) });
    await expect(service.trasladar(3064, doc, 'u')).rejects.toThrow('ya fue trasladado al No. 3070');
    expect(repo.trasladar).not.toHaveBeenCalled();
  });

  it('no traslada a la misma relación', async () => {
    const { service } = crear();
    await expect(service.trasladar(3064, { ...doc, relacion: 30 }, 'u')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige depreciación generada', async () => {
    const { service } = crear({ infoTraslado: vi.fn().mockResolvedValue({ mesesGenerados: 0, ultimoPeriodo: null, siguientePeriodo: null }) });
    await expect(service.trasladar(3064, doc, 'u')).rejects.toBeInstanceOf(ConflictException);
  });

  it('exige que exista el empleado que autoriza', async () => {
    const { service, repo } = crear({ empleado: vi.fn().mockResolvedValue(null) });
    await expect(service.trasladar(3064, doc, 'u')).rejects.toThrow('No existe el empleado 1234');
    expect(repo.trasladar).not.toHaveBeenCalled();
  });

  it('si el procedimiento falla no se hizo ningún cambio', async () => {
    const { service } = crear({ trasladar: vi.fn().mockRejectedValue(new ErrorGeneracion('-09 -5')) });
    await expect(service.trasladar(3064, doc, 'u')).rejects.toThrow('No se realizó ningún cambio');
  });
});
