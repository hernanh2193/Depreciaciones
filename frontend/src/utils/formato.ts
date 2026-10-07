/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' (sin pasar por Date para evitar desfases de zona horaria). */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function porcentaje(n: number | null | undefined): string {
  if (n === null || n === undefined) return ''
  return `${n.toLocaleString('es-GT', { maximumFractionDigits: 2 })} %`
}
