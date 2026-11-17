/** Descarga filas como CSV (separador ';' y BOM para que Excel en español lo abra con tildes y columnas). */
export function descargarCsv<T>(nombre: string, columnas: { titulo: string; valor: (fila: T) => unknown }[], filas: T[]) {
  const celda = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'number' ? v.toLocaleString('es-GT', { useGrouping: false, maximumFractionDigits: 6 }) : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lineas = [columnas.map((c) => celda(c.titulo)).join(';'), ...filas.map((f) => columnas.map((c) => celda(c.valor(f))).join(';'))]
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre.endsWith('.csv') ? nombre : `${nombre}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
