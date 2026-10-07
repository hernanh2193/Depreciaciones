import { factorMensual, primerDiaDelMes, valorMensual } from './calculo.js';

describe('factorMensual (igual al sistema Java)', () => {
  // Pares porcentaje -> factor tomados de DEP_CONTROL_DEPRECIACION en producción
  it.each([
    [2.5, 0.002083],
    [5, 0.004167],
    [10, 0.008333],
    [15, 0.0125],
    [20, 0.016667],
    [25, 0.020833],
  ])('%s %% -> %s', (pct, esperado) => {
    expect(factorMensual(pct)).toBe(esperado);
  });
});

describe('valorMensual', () => {
  // Activos reales: correlativos 3064, 3063 y 3062
  it.each([
    [89588.39, 0.016667, 1493.15],
    [328166.9, 0.016667, 5469.54],
    [2550, 0.016667, 42.48],
  ])('(%s - 1) x %s = %s', (valor, factor, esperado) => {
    expect(valorMensual(valor, factor)).toBe(esperado);
  });
});

describe('primerDiaDelMes', () => {
  it('devuelve el día 1 del mismo mes', () => {
    expect(primerDiaDelMes('2025-12-12')).toBe('2025-12-01');
  });
});
