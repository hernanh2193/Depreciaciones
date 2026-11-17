import { api } from './client'

export interface DatoCuenta {
  cuenta: number
  descripcion: string
  cantidad: number
  valor: number
}

export interface DatoMes {
  mes: number
  cantidad: number
  valor: number
}

export const graficasApi = {
  opciones: () => api<{ anios: number[]; cuentas: { valor: number; etiqueta: string }[] }>('/graficas/opciones'),
  porCuenta: (anulados: boolean) => api<DatoCuenta[]>(`/graficas/cuentas?anulados=${anulados}`),
  compras: (anio: number, cuenta: string) =>
    api<DatoMes[]>(`/graficas/compras?anio=${anio}${cuenta ? `&cuenta=${cuenta}` : ''}`),
}

/** Q 1,234.56 */
export const quetzales = (n: number) =>
  `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Formato corto para ejes y etiquetas: Q 1.5 M · Q 850 K · Q 900 */
export function quetzalesCorto(n: number): string {
  const abs = Math.abs(n)
  const f = (x: number, s: string) => `Q ${x.toLocaleString('es-GT', { maximumFractionDigits: x < 10 ? 1 : 0 })}${s}`
  if (abs >= 1e6) return f(n / 1e6, ' M')
  if (abs >= 1e3) return f(n / 1e3, ' K')
  return f(n, '')
}

export const entero = (n: number) => n.toLocaleString('es-GT', { maximumFractionDigits: 0 })
