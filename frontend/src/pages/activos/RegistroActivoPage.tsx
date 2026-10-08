import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { activosApi, factorMensual, mesesAjuste, valorMensual, type ResultadoRegistro } from '../../api/activos'
import { ApiError } from '../../api/client'
import { useDatos } from '../../hooks/useDatos'
import { moneda, porcentaje } from '../../utils/formato'
import { CamposActivo } from './CamposActivo'
import { aDatos, FORM_VACIO, type FormActivo } from './formActivo'

const mesActual = () => {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
}

const nombreMes = (yyyyMm: string) => yyyyMm.split('-').reverse().join('/')

export function RegistroActivoPage() {
  const relaciones = useDatos(activosApi.relaciones)
  const [relacion, setRelacion] = useState('')
  const [form, setForm] = useState<FormActivo>(FORM_VACIO)
  const [conAjuste, setConAjuste] = useState(false)
  const [mesProceso, setMesProceso] = useState(mesActual)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [registrado, setRegistrado] = useState<ResultadoRegistro | null>(null)

  const seleccionada = relaciones.datos?.find((r) => String(r.codigo) === relacion)
  const vista = useMemo(() => {
    const valor = Number(form.valorOriginal)
    if (!seleccionada || !(valor > 1)) return null
    const factor = factorMensual(seleccionada.porcentaje)
    const mensual = valorMensual(valor, factor)
    const meses = conAjuste && form.fechaInicio && mesProceso ? mesesAjuste(form.fechaInicio, mesProceso) : null
    return {
      factor,
      mensual,
      mesesTotales: mensual > 0 ? Math.round(valor / mensual) : 0,
      ajuste: meses === null ? null : { meses, monto: Math.round(meses * mensual * 100) / 100 },
    }
  }, [seleccionada, form.valorOriginal, form.fechaInicio, conAjuste, mesProceso])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setRegistrado(null)
    setEnviando(true)
    try {
      const r = await activosApi.crear({
        ...aDatos(form),
        relacion: Number(relacion),
        mesProcesoAjuste: conAjuste ? mesProceso : null,
      })
      setRegistrado(r)
      setForm(FORM_VACIO)
      setRelacion('')
      setConAjuste(false)
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
          {moneda(registrado.valorMensual)}
          {registrado.ajuste &&
            ` y ajuste de ${registrado.ajuste.meses} meses (${moneda(registrado.ajuste.monto)}) en ${nombreMes(
              registrado.ajuste.mesProceso,
            )}; ${registrado.ajuste.mesesGenerados} registros de depreciación generados`}
          . <Link to={`/activos/${registrado.correlativo}`}>Ver ficha del activo</Link>
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

        <fieldset className="col-completa ajuste">
          <label className="check">
            <input type="checkbox" checked={conAjuste} onChange={(e) => setConAjuste(e.target.checked)} />
            Registro con ajuste (activo registrado con atraso)
          </label>
          {conAjuste && (
            <>
              <p className="nota">
                La depreciación de los meses atrasados se registra en <strong>un solo movimiento</strong> en el mes de
                proceso ("AJUSTE DE DEPRECIACION POR n MESES") y a partir del mes siguiente continúa mes a mes.
              </p>
              <label>
                Mes de proceso del ajuste
                <input type="month" value={mesProceso} max={mesActual()} onChange={(e) => setMesProceso(e.target.value)} required />
              </label>
            </>
          )}
        </fieldset>

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
            <strong>{vista ? vista.mesesTotales : '—'}</strong>
          </div>
          {vista?.ajuste && (
            <div>
              <span>Ajuste</span>
              <strong>
                {vista.ajuste.meses > 0 ? `${vista.ajuste.meses} meses · ${moneda(vista.ajuste.monto)}` : 'Mes no válido'}
              </strong>
            </div>
          )}
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
