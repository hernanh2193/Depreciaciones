import { ConflictException } from '@nestjs/common';
import type { BitacoraService } from '../bitacora/bitacora.service.js';
import { PonerAlDiaService } from './poner-al-dia.service.js';
import type { ActivoAtrasado, ProcesosRepository } from './procesos.repository.js';

const a = (correlativo: number, extra: Partial<ActivoAtrasado> = {}): ActivoAtrasado => ({
  correlativo,
  descripcion: 'X',
  fechaInicio: '2025-01-15',
  valorMensual: 10,
  ultimoPeriodo: 202606,
  mesesFaltantes: 4,
  tienePeriodoInicio: 1,
  ...extra,
});

function crear(repoParcial: Record<string, unknown> = {}) {
  const repo = {
    existeCuenta: vi.fn().mockResolvedValue(true),
    periodoActual: vi.fn().mockResolvedValue(202610),
    atrasados: vi.fn().mockResolvedValue([a(1), a(2, { ultimoPeriodo: 202608, mesesFaltantes: 2 }), a(3, { ultimoPeriodo: null, mesesFaltantes: null })]),
    periodosEntre: vi.fn().mockResolvedValue([202607, 202608, 202609, 202610]),
    generarDesdeInicio: vi.fn().mockResolvedValue('0'),
    generar: vi.fn().mockResolvedValue('0'),
    ...repoParcial,
  };
  const bitacora = { registrar: vi.fn() };
  return { service: new PonerAlDiaService(repo as unknown as ProcesosRepository, bitacora as unknown as BitacoraService), repo };
}

/** Espera a que termine el trabajo en segundo plano. */
async function terminar(s: PonerAlDiaService) {
  for (let i = 0; i < 50 && !s.estado()?.fin; i++) await new Promise((r) => setTimeout(r, 1));
  return s.estado()!;
}

describe('PonerAlDiaService.vista', () => {
  it('separa activos sin detalle y atrasados, y procesa desde el último mes más antiguo', async () => {
    const { service, repo } = crear();
    const v = await service.vista(1232);
    expect(v.sinDetalle.map((x) => x.correlativo)).toEqual([3]);
    expect(v.atrasados.map((x) => x.correlativo)).toEqual([1, 2]);
    expect(repo.periodosEntre).toHaveBeenCalledWith(202606, 202610);
    // 4 + 2 faltantes + 21 meses (feb-2025..oct-2026) del activo sin detalle
    expect(v.mesesEstimados).toBe(27);
    expect(v.bloqueos).toEqual([]);
  });

  it('bloquea con activos de mensual 0', async () => {
    const { service } = crear({ atrasados: vi.fn().mockResolvedValue([a(2827, { valorMensual: 0, ultimoPeriodo: null })]) });
    expect((await service.vista(1237)).bloqueos.join()).toContain('2827');
  });

  it('bloquea activos sin detalle cuyo mes de inicio no tiene periodo', async () => {
    const { service } = crear({ atrasados: vi.fn().mockResolvedValue([a(5, { ultimoPeriodo: null, tienePeriodoInicio: 0 })]) });
    expect((await service.vista(1232)).bloqueos.join()).toContain('no tienen el periodo');
  });
});

describe('PonerAlDiaService.iniciar', () => {
  it('genera primero los activos sin detalle y luego cada periodo en orden', async () => {
    const atrasados = vi
      .fn()
      .mockResolvedValueOnce([a(1), a(3, { ultimoPeriodo: null })]) // vista
      .mockResolvedValueOnce([a(1)]); // verificación después del paso 1
    const { service, repo } = crear({ atrasados });
    await service.iniciar(1232, 'u');
    const t = await terminar(service);
    expect(t.fase).toBe('terminado');
    expect(repo.generarDesdeInicio).toHaveBeenCalledWith('u', 3, '2025-01-15');
    expect(repo.generar.mock.calls.map((c) => c[2])).toEqual([202607, 202608, 202609, 202610]);
    expect(t).toMatchObject({ activosCompletados: 1, periodosProcesados: 4, avance: 5, total: 5 });
  });

  it('se detiene si un activo sigue sin detalle (no lo hace empezar tarde)', async () => {
    const atrasados = vi.fn().mockResolvedValue([a(1), a(3, { ultimoPeriodo: null })]);
    const { service, repo } = crear({ atrasados, generarDesdeInicio: vi.fn().mockResolvedValue(' -08 error') });
    await service.iniciar(1232, 'u');
    const t = await terminar(service);
    expect(t.fase).toBe('error');
    expect(repo.generar).not.toHaveBeenCalled();
  });

  it('se detiene en el primer periodo que falla', async () => {
    const atrasados = vi.fn().mockResolvedValue([a(1)]);
    const generar = vi.fn().mockResolvedValueOnce('0').mockResolvedValueOnce(' -07 error');
    const { service } = crear({ atrasados, generar });
    await service.iniciar(1232, 'u');
    const t = await terminar(service);
    expect(t.fase).toBe('error');
    expect(t.periodosProcesados).toBe(1);
  });

  it('no permite dos procesos a la vez', async () => {
    const { service } = crear({ generar: vi.fn().mockReturnValue(new Promise(() => {})) });
    await service.iniciar(1232, 'u');
    await expect(service.iniciar(1231, 'v')).rejects.toBeInstanceOf(ConflictException);
  });

  it('cuenta al día responde 409', async () => {
    const { service } = crear({ atrasados: vi.fn().mockResolvedValue([]) });
    await expect(service.iniciar(1232, 'u')).rejects.toThrow('ya está al día');
  });
});
