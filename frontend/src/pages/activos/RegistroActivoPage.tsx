import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { activosApi, factorMensual, valorMensual } from '../../api/activos'
import { ApiError } from '../../api/client'
import { useDatos } from '../../hooks/useDatos'
import { moneda, porcentaje } from '../../utils/formato'
import { CamposActivo } from './CamposActivo'
import { aDatos, FORM_VACIO, type FormActivo } from './formActivo'

export function RegistroActivoPage() {
  const relaciones = useDatos(activosApi.relaciones)
  const [relacion, setRelacion] = useState('')
  const [form, setForm] = useState<FormActivo>(FORM_VACIO)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [registrado, setRegistrado] = useState<{ correlativo: number; valorMensual: number } | null>(null)

  const seleccionada = relaciones.datos?.find((r) => String(r.codigo) === relacion)
  const vista = useMemo(() => {
    const valor = Number(form.valorOriginal)
    if (!seleccionada || !(valor > 1)) return null
    const factor = factorMensual(seleccionada.porcentaje)
    return { factor, mensual: valorMensual(valor, factor), meses: Math.round(valor / valorMensual(valor, factor)) }
  }, [seleccionada, form.valorOriginal])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setRegistrado(null)
    setEnviando(true)
    try {
      const r = await activosApi.crear({ ...aDatos(form), relacion: Number(relacion) })
      setRegistrado({ correlativo: r.correlativo, valorMensual: r.valorMensual })
      setForm(FORM_VACIO)
      setRelacion('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <h1>Registro de activos</h1>
        <p className="nota">
          Al guardar, el sistema registra el activo y genera su depreciación mensual desde el mes siguiente a la fecha
          de inicio hasta el mes actual. Si la generación falla, el activo no se guarda.
        </p>
      </header>

      {registrado && (
        <p className="msg-ok">
          Activo <strong>{registrado.correlativo}</strong> registrado con depreciación mensual de{' '}
          {moneda(registrado.valorMensual)}. <Link to={`/activos/${registrado.correlativo}`}>Ver ficha del activo</Link>
        </p>
      )}

      <form className="panel form-grid" onSubmit={guardar}>
        <label className="col-completa">
          Relación de cuentas (cuenta / subcuenta / división)
          <select value={relacion} onChange={(e) => setRelacion(e.target.value)} required>
            <option value="">{relaciones.datos ? 'Seleccione…' : 'Cargando…'}</option>
            {relaciones.datos?.map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {r.codigo}. {r.etiqueta} ({porcentaje(r.porcentaje)})
              </option>
            ))}
          </select>
        </label>
        {relaciones.error && <p className="msg-error col-completa">{relaciones.error}</p>}

        <CamposActivo form={form} onChange={setForm} />

        <div className="resumen-calculo col-completa">
          <div>
            <span>Porcentaje anual</span>
            <strong>{seleccionada ? porcentaje(seleccionada.porcentaje) : '—'}</strong>
          </div>
          <div>
            <span>Factor mensual</span>
            <strong>{vista ? vista.factor.toFixed(6) : '—'}</strong>
          </div>
          <div>
            <span>Depreciación mensual</span>
            <strong>{vista ? moneda(vista.mensual) : '—'}</strong>
          </div>
          <div>
            <span>Meses aproximados</span>
            <strong>{vista ? vista.meses : '—'}</strong>
          </div>
        </div>

        {error && <p className="msg-error col-completa">{error}</p>}
        <div className="col-completa acciones">
          <button type="submit" className="btn-primario" disabled={enviando}>
            {enviando ? 'Guardando y generando depreciación…' : 'Guardar activo'}
          </button>
        </div>
      </form>
    </section>
  )
}
