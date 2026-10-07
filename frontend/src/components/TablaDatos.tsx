import { useMemo, useState, type ReactNode } from 'react'

export interface Columna<T> {
  titulo: string
  celda: (fila: T) => ReactNode
  alinear?: 'izq' | 'der' | 'centro'
}

interface Props<T> {
  columnas: Columna<T>[]
  filas: T[] | null
  clave: (fila: T) => string | number
  /** Texto en el que busca el filtro (por defecto, todas las celdas que sean texto o número). */
  textoBusqueda?: (fila: T) => string
  cargando?: boolean
  error?: string
  vacio?: string
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function TablaDatos<T>({ columnas, filas, clave, textoBusqueda, cargando, error, vacio = 'Sin registros' }: Props<T>) {
  const [filtro, setFiltro] = useState('')

  const visibles = useMemo(() => {
    if (!filas) return []
    const f = normalizar(filtro.trim())
    if (!f) return filas
    const texto =
      textoBusqueda ??
      ((fila: T) =>
        columnas
          .map((c) => c.celda(fila))
          .filter((v) => typeof v === 'string' || typeof v === 'number')
          .join(' '))
    return filas.filter((fila) => normalizar(texto(fila)).includes(f))
  }, [filas, filtro, columnas, textoBusqueda])

  return (
    <div className="tabla-contenedor">
      <div className="tabla-barra">
        <input
          type="search"
          placeholder="Buscar…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          aria-label="Buscar en la tabla"
        />
        <span className="tabla-conteo">
          {filas ? `${visibles.length} de ${filas.length} registros` : ''}
        </span>
      </div>
      {error && <p className="msg-error">{error}</p>}
      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c.titulo} className={c.alinear ? `al-${c.alinear}` : undefined}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={columnas.length} className="tabla-vacia">
                  Cargando…
                </td>
              </tr>
            )}
            {!cargando && !error && visibles.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="tabla-vacia">
                  {filtro ? 'Ningún registro coincide con la búsqueda' : vacio}
                </td>
              </tr>
            )}
            {visibles.map((fila) => (
              <tr key={clave(fila)}>
                {columnas.map((c) => (
                  <td key={c.titulo} className={c.alinear ? `al-${c.alinear}` : undefined}>
                    {c.celda(fila)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
