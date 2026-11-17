import { useEffect, useRef, useState } from 'react'

export interface DatoBarra {
  clave: string | number
  /** Texto del eje (corto). */
  etiqueta: string
  /** Texto completo para el tooltip y la tabla. */
  nombre?: string
  valor: number
}

interface Props {
  titulo: string
  datos: DatoBarra[]
  /** horizontal: barras (categorías con nombre largo) · vertical: columnas (meses). */
  orientacion: 'horizontal' | 'vertical'
  /** Formato completo (tooltip, etiqueta en la barra). */
  formato: (n: number) => string
  /** Formato corto del eje. */
  formatoEje?: (n: number) => string
  /** 'todas' = valor en el extremo de cada barra (pocas barras) · 'maximo' = solo la mayor. */
  etiquetas?: 'todas' | 'maximo'
}

const COLOR = '#2a64a8' // azul institucional validado: L 0.43–0.77 y contraste ≥ 3:1 sobre blanco
const MAX_GROSOR = 24
const RADIO = 4

/** Ticks "redondos" de 0 al máximo (4–5 divisiones). */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const bruto = max / 4
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? 10 * mag
  return Array.from({ length: Math.ceil(max / paso) + 1 }, (_, i) => i * paso)
}

/** Rectángulo con esquinas de 4px solo en el extremo de dato (recto en la línea base). */
function barra(x: number, y: number, w: number, h: number, orientacion: 'horizontal' | 'vertical'): string {
  if (w <= 0 || h <= 0) return ''
  if (orientacion === 'horizontal') {
    const r = Math.min(RADIO, w, h / 2)
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`
  }
  const r = Math.min(RADIO, h, w / 2)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

/**
 * Gráfica de barras de UNA serie en SVG (sin librerías): una sola escala, barras finas con extremo redondeado,
 * cuadrícula tenue, valor en el extremo (todas o solo la mayor) y tooltip al pasar el mouse o con el teclado.
 */
export function GraficoBarras({ titulo, datos, orientacion, formato, formatoEje = formato, etiquetas = 'todas' }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(480)
  const [activo, setActivo] = useState<number | null>(null)

  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(260, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const max = Math.max(0, ...datos.map((d) => d.valor))
  const marcas = ticks(max)
  const tope = marcas[marcas.length - 1]
  const iMax = datos.findIndex((d) => d.valor === max && max > 0)
  const conEtiqueta = (i: number) => etiquetas === 'todas' || i === iMax

  // Geometría
  const horizontal = orientacion === 'horizontal'
  const izq = horizontal ? Math.min(150, ancho * 0.32) : 52
  const der = horizontal ? 70 : 12
  const arriba = 18
  const abajo = horizontal ? 24 : 26
  const banda = horizontal ? 40 : 0
  const alto = horizontal ? arriba + abajo + banda * datos.length : 240
  const anchoPlot = ancho - izq - der
  const altoPlot = alto - arriba - abajo
  const bandaV = datos.length ? anchoPlot / datos.length : anchoPlot
  const grosor = Math.min(MAX_GROSOR, (horizontal ? banda : bandaV) * 0.6)
  const escala = (v: number) => (tope ? v / tope : 0) * (horizontal ? anchoPlot : altoPlot)

  const d = activo !== null ? datos[activo] : null
  const centro = (i: number) =>
    horizontal ? { x: izq + escala(datos[i].valor), y: arriba + banda * i + banda / 2 } : { x: izq + bandaV * i + bandaV / 2, y: arriba + altoPlot - escala(datos[i].valor) }

  return (
    <figure className="grafico">
      <figcaption className="grafico-titulo">{titulo}</figcaption>
      <div ref={contenedor} className="grafico-lienzo" onMouseLeave={() => setActivo(null)}>
        <svg width={ancho} height={alto} role="img" aria-label={titulo}>
          {/* Cuadrícula y eje de valores */}
          {marcas.map((m) => {
            const p = escala(m)
            return horizontal ? (
              <g key={m}>
                <line x1={izq + p} x2={izq + p} y1={arriba} y2={arriba + altoPlot} className="grafico-grid" />
                <text x={izq + p} y={alto - 6} textAnchor="middle" className="grafico-eje">
                  {formatoEje(m)}
                </text>
              </g>
            ) : (
              <g key={m}>
                <line x1={izq} x2={izq + anchoPlot} y1={arriba + altoPlot - p} y2={arriba + altoPlot - p} className="grafico-grid" />
                <text x={izq - 6} y={arriba + altoPlot - p + 4} textAnchor="end" className="grafico-eje">
                  {formatoEje(m)}
                </text>
              </g>
            )
          })}

          {datos.map((dato, i) => {
            const largo = escala(dato.valor)
            const enfocado = activo === i
            const ruta = horizontal
              ? barra(izq, arriba + banda * i + (banda - grosor) / 2, largo, grosor, 'horizontal')
              : barra(izq + bandaV * i + (bandaV - grosor) / 2, arriba + altoPlot - largo, grosor, largo, 'vertical')
            return (
              <g
                key={dato.clave}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${dato.nombre ?? dato.etiqueta}: ${formato(dato.valor)}`}
                onMouseEnter={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                className="grafico-marca"
              >
                {/* Zona de hover: toda la banda, más grande que la barra */}
                {horizontal ? (
                  <rect x={0} y={arriba + banda * i} width={ancho} height={banda} className="grafico-hit" />
                ) : (
                  <rect x={izq + bandaV * i} y={arriba} width={bandaV} height={altoPlot} className="grafico-hit" />
                )}
                {enfocado && horizontal && <rect x={0} y={arriba + banda * i} width={ancho} height={banda} className="grafico-resalte" />}
                {enfocado && !horizontal && <rect x={izq + bandaV * i} y={arriba} width={bandaV} height={altoPlot} className="grafico-resalte" />}
                {ruta && <path d={ruta} fill={COLOR} opacity={activo === null || enfocado ? 1 : 0.55} />}
                {/* Etiqueta de categoría */}
                {horizontal ? (
                  <text x={izq - 8} y={arriba + banda * i + banda / 2 + 4} textAnchor="end" className="grafico-cat">
                    {dato.etiqueta}
                  </text>
                ) : (
                  <text x={izq + bandaV * i + bandaV / 2} y={alto - 8} textAnchor="middle" className="grafico-eje">
                    {dato.etiqueta}
                  </text>
                )}
                {/* Valor en el extremo de la barra */}
                {conEtiqueta(i) && dato.valor > 0 && (
                  horizontal ? (
                    <text x={izq + largo + 6} y={arriba + banda * i + banda / 2 + 4} className="grafico-valor">
                      {formatoEje(dato.valor)}
                    </text>
                  ) : (
                    <text x={izq + bandaV * i + bandaV / 2} y={arriba + altoPlot - largo - 6} textAnchor="middle" className="grafico-valor">
                      {formatoEje(dato.valor)}
                    </text>
                  )
                )}
              </g>
            )
          })}
          {/* Línea base */}
          {horizontal ? (
            <line x1={izq} x2={izq} y1={arriba} y2={arriba + altoPlot} className="grafico-base" />
          ) : (
            <line x1={izq} x2={izq + anchoPlot} y1={arriba + altoPlot} y2={arriba + altoPlot} className="grafico-base" />
          )}
        </svg>

        {d && activo !== null && (
          <div
            className="grafico-tooltip"
            style={{ left: Math.min(centro(activo).x + 10, ancho - 190), top: Math.max(centro(activo).y - 48, 0) }}
            role="status"
          >
            <strong>{d.nombre ?? d.etiqueta}</strong>
            <span>{formato(d.valor)}</span>
          </div>
        )}
      </div>
    </figure>
  )
}
