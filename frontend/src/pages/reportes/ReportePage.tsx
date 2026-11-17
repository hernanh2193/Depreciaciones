import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { reportesApi, type DefReporte, type ParametroReporte } from '../../api/reportes'
import { useDatos } from '../../hooks/useDatos'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const hoy = new Date()

/** Pantalla de un reporte: pide sus parámetros, genera el PDF en el servidor y lo muestra (como el iframe de Java). */
export function ReportePage({ reporte }: { reporte: DefReporte }) {
  const usa = (p: ParametroReporte) => reporte.parametros.includes(p)
  const necesitaOpciones = usa('cuenta') || usa('relacion')
  const [valores, setValores] = useState<Partial<Record<ParametroReporte, string>>>({
    anio: String(hoy.getFullYear()),
    mes: String(hoy.getMonth() + 1),
  })
  const [pdf, setPdf] = useState<{ url: string; nombre: string } | null>(null)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')

  // Libera la URL del PDF anterior al reemplazarlo o al salir de la pantalla
  useEffect(() => () => {
    if (pdf) URL.revokeObjectURL(pdf.url)
  }, [pdf])

  async function generar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setGenerando(true)
    try {
      const params = Object.fromEntries(reporte.parametros.map((p) => [p, valores[p] ?? '']))
      const { blob, nombre } = await reportesApi.generar(reporte.clave, params)
      setPdf({ url: URL.createObjectURL(blob), nombre })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
    } finally {
      setGenerando(false)
    }
  }

  const campo = (p: ParametroReporte) => ({
    value: valores[p] ?? '',
    onChange: (e: { target: { value: string } }) => setValores({ ...valores, [p]: e.target.value }),
  })

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <h1>{reporte.titulo}</h1>
        <p className="nota">{reporte.descripcion}</p>
      </header>

      <form className="panel form-linea" onSubmit={generar}>
        {necesitaOpciones && <OpcionesCampos usa={usa} campo={campo} />}
        {usa('activo') && (
          <label>
            No. de activo
            <input type="number" inputMode="numeric" min={1} step={1} required autoFocus {...campo('activo')} />
          </label>
        )}
        {usa('anio') && (
          <label>
            Año
            <input type="number" inputMode="numeric" min={1980} max={2100} step={1} required {...campo('anio')} />
          </label>
        )}
        {usa('mes') && (
          <label>
            Mes
            <select required {...campo('mes')}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="btn-primario" disabled={generando}>
          {generando ? 'Generando…' : 'Generar PDF'}
        </button>
        {pdf && (
          <a className="btn-secundario" href={pdf.url} download={pdf.nombre}>
            Descargar
          </a>
        )}
      </form>

      {error && <p className="msg-error">{error}</p>}
      {pdf && <iframe className="visor-pdf" src={pdf.url} title={reporte.titulo} />}
    </section>
  )
}

/** Listas de cuentas y relaciones (se cargan solo en los reportes que las usan). */
function OpcionesCampos({
  usa,
  campo,
}: {
  usa: (p: ParametroReporte) => boolean
  campo: (p: ParametroReporte) => { value: string; onChange: (e: { target: { value: string } }) => void }
}) {
  const opciones = useDatos(reportesApi.opciones)
  const cargando = opciones.datos ? 'Seleccione…' : 'Cargando…'
  return (
    <>
      {usa('cuenta') && (
        <label className="crece">
          Cuenta
          <select required {...campo('cuenta')}>
            <option value="">{cargando}</option>
            {opciones.datos?.cuentas.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
      )}
      {usa('relacion') && (
        <label className="crece">
          Relación de cuentas
          <select required {...campo('relacion')}>
            <option value="">{cargando}</option>
            {opciones.datos?.relaciones.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </label>
      )}
      {opciones.error && <p className="msg-error form-mensaje">{opciones.error}</p>}
    </>
  )
}
