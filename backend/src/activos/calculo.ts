/**
 * Cálculos de depreciación, idénticos a los del sistema Java (CatActivoCtrl.onOK$avalor):
 *
 *   float rs = ((float) pct / 12) / 100;
 *   factor   = new BigDecimal(rs).setScale(6, RoundingMode.HALF_EVEN)
 *   mensual  = (valorOriginal - 1) * factor      // Q1.00 de valor residual
 *
 * Se replica la aritmética en float (Math.fround) para obtener exactamente los mismos factores
 * que ya están en DEP_CONTROL_DEPRECIACION (p. ej. 20 % -> 0.016667, 2.5 % -> 0.002083).
 */
export function factorMensual(porcentajeAnual: number): number {
  const rs = Math.fround(Math.fround(Math.fround(porcentajeAnual) / 12) / 100);
  return Number(rs.toFixed(6));
}

/** Valor mensual redondeado a 2 decimales, como lo guarda Oracle en CRTL_VALOR_MENSUAL NUMBER(16,2). */
export function valorMensual(valorOriginal: number, factor: number): number {
  const bruto = (valorOriginal - 1) * factor;
  // Redondeo half-up a centavos tolerante a errores binarios (p. ej. 1.005)
  return Math.round((bruto + Number.EPSILON) * 100) / 100;
}

/** Primer día del mes de una fecha 'YYYY-MM-DD'. */
export function primerDiaDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}
