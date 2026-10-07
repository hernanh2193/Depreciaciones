import { useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { catalogosApi, type EstadoPeriodo, type Periodo } from '../../api/catalogos'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useDatos } from '../../hooks/useDatos'
import { fecha } from '../../utils/formato'

const NOMBRE_ESTADO: Record<EstadoPeriodo, string> = { R: 'REGISTRADA', P: 'PROCESADA' }

/** Fechas esperadas de un periodo AAAAMM: del día 1 al último día del mes. */
function fechasEsperadas(codigo: number) {
  const anio = Math.floor(codigo / 100)
  const mes = codigo % 100
  const mm = String(mes).padStart(2, '0')
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return { inicio: `${anio}-${mm}-01`, final: `${anio}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

/** Describe por qué las fechas de un periodo no coinciden con su mes, o '' si están bien. */
function problemaPeriodo(p: Periodo): string {
  const esperado = fechasEsperadas(p.codigo)
  const problemas: string[] = []
  if (p.fechaInicio !== esperado.inicio) problemas.push(`inicio esperado ${fecha(esperado.inicio)}`)
  if (p.fechaFinal !== esperado.final) problemas.push(`final esperado ${fecha(esperado.final)}`)
  return problemas.join('; ')
}

/** Mes siguiente al último periodo registrado, en formato YYYY-MM. */
function mesSiguiente(periodos: Periodo[] | null): string {
  if (!periodos?.length) return ''
  const ultimo = Math.max(...periodos.map((p) => p.codigo))
  let anio = Math.floor(ultimo / 100)
  let mes = (ultimo % 100) + 1
  if (mes > 12) {
    mes = 1
    anio++
  }
  return `${anio}-${String(mes).padStart(2, '0')}`
}

const COLUMNAS: Columna<Periodo>[] = [
  { titulo: 'Periodo', celda: (p) => p.codigo, alinear: 'der' },
  { titulo: 'Fecha inicio', celda: (p) => fecha(p.fechaInicio) },
  { titulo: 'Fecha final', celda: (p) => fecha(p.fechaFinal) },
  {
    titulo: 'Estado',
    celda: (p) => (
      <span className={`badge ${p.estado === 'P' ? 'badge-gris' : 'badge-azul'}`}>{NOMBRE_ESTADO[p.estado] ?? p.estado}</span>
    ),
  },
  {
    titulo: 'Observación',
    celda: (p) => {
      const problema = problemaPeriodo(p)
      return problema ? (
        <span className="badge badge-alerta" title={problema}>
          Revisar: {problema}
        </span>
      ) : null
    },
  },
]

export function PeriodosPage() {
  const { datos, error, cargando, recargar } = useDatos(catalogosApi.periodos)
  const [mes, setMes] = useState('')
  const [estado, setEstado] = useState<EstadoPeriodo>('R')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [soloRevisar, setSoloRevisar] = useState(false)

  const sugerido = useMemo(() => mesSiguiente(datos), [datos])
  const conProblema = useMemo(() => (datos ?? []).filter((p) => problemaPeriodo(p)).length, [datos])
  const filas = useMemo(() => (soloRevisar ? (datos ?? []).filter((p) => problemaPeriodo(p)) : datos), [datos, soloRevisar])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    setEnviando(true)
    try {
      const r = await catalogosApi.crearPeriodo({ mes: mes || sugerido, estado })
      setMsg({ tipo: 'ok', texto: `Periodo ${r.codigo} registrado (${fecha(r.fechaInicio)} al ${fecha(r.fechaFinal)})` })
      setMes('')
      recargar()
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <h1>Periodos</h1>
        <p className="nota">
          Cada periodo corresponde a un mes. Al elegir el mes, el sistema calcula el código (AAAAMM) y las fechas del
          primer al último día.
        </p>
      </header>

      <form className="panel form-linea" onSubmit={guardar}>
        <label>
          Mes
          <input type="month" value={mes || sugerido} onChange={(e) => setMes(e.target.value)} required />
        </label>
        <label>
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoPeriodo)}>
            <option value="R">REGISTRADA</option>
            <option value="P">PROCESADA</option>
          </select>
        </label>
        <button type="submit" className="btn-primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
        {msg && <p className={`form-mensaje ${msg.tipo === 'ok' ? 'msg-ok' : 'msg-error'}`}>{msg.texto}</p>}
      </form>

      {conProblema > 0 && (
        <div className="aviso">
          <strong>{conProblema} periodos</strong> tienen fechas que no coinciden con su mes. Pueden afectar el cálculo
          de la depreciación; revíselos con el administrador de la base de datos.
          <label className="check">
            <input type="checkbox" checked={soloRevisar} onChange={(e) => setSoloRevisar(e.target.checked)} />
            Mostrar solo estos
          </label>
        </div>
      )}

      <TablaDatos columnas={COLUMNAS} filas={filas} clave={(p) => p.codigo} cargando={cargando} error={error} />
    </section>
  )
}
