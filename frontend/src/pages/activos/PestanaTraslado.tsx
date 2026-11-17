import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { activosApi, type Activo, type DocumentoTraslado, type VistaTraslado } from '../../api/activos'
import { ApiError } from '../../api/client'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useDatos } from '../../hooks/useDatos'
import { fecha, moneda, porcentaje } from '../../utils/formato'

const TIPO_DOC: Record<number, string> = { 1: 'TRASLADO', 2: 'AJUSTE' }
const textoError = (err: unknown) => (err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
const hoy = () => new Date().toISOString().slice(0, 10)

const COLUMNAS_DOC: Columna<DocumentoTraslado>[] = [
  { titulo: 'Activo anterior', celda: (d) => <Link to={`/activos/${d.activoAnterior}`}>{d.activoAnterior}</Link> },
  { titulo: 'Activo nuevo', celda: (d) => <Link to={`/activos/${d.activoNuevo}`}>{d.activoNuevo}</Link> },
  { titulo: 'Tipo', celda: (d) => (d.tipo ? TIPO_DOC[d.tipo] ?? d.tipo : '') },
  { titulo: 'Documento', celda: (d) => d.documento },
  { titulo: 'Fecha', celda: (d) => fecha(d.fecha) },
  { titulo: 'Autoriza', celda: (d) => d.autoriza },
  { titulo: 'Motivo', celda: (d) => d.motivo },
  { titulo: 'Registrado por', celda: (d) => `${d.usuario ?? ''} ${fecha(d.fechaRegistro)}` },
]

/** Traslado del activo a otra relación de cuentas (en Java quedó sin terminar: el botón Guardar no hacía nada). */
export function PestanaTraslado({ activo, onCambio }: { activo: Activo; onCambio: () => void }) {
  const id = activo.correlativo
  const cargarDocs = useCallback(() => activosApi.documentosTraslado(id), [id])
  const docs = useDatos(cargarDocs)
  const puedeTrasladar = activo.estado === 'A' && !activo.trasladadoA

  return (
    <div className="pagina">
      {activo.trasladadoA && (
        <p className="aviso">
          Este activo fue trasladado al <Link to={`/activos/${activo.trasladadoA}`}>activo No. {activo.trasladadoA}</Link>
          {activo.observacion && ` (${activo.observacion})`}.
        </p>
      )}
      {!puedeTrasladar && !activo.trasladadoA && (
        <p className="aviso">Solo se pueden trasladar activos en estado ACTIVO.</p>
      )}
      {puedeTrasladar && <FormTraslado activo={activo} onCambio={onCambio} />}

      <h2>Documentos de traslado</h2>
      <TablaDatos
        columnas={COLUMNAS_DOC}
        filas={docs.datos}
        clave={(d) => `${d.activoAnterior}-${d.activoNuevo}`}
        cargando={docs.cargando}
        error={docs.error}
        sinBuscador
        vacio="Este activo no tiene traslados registrados"
      />
    </div>
  )
}

function FormTraslado({ activo, onCambio }: { activo: Activo; onCambio: () => void }) {
  const navigate = useNavigate()
  const relaciones = useDatos(activosApi.relaciones)
  const [form, setForm] = useState({ relacion: '', tipo: '1', documento: '', fecha: hoy(), autoriza: '', motivo: '' })
  const [vista, setVista] = useState<VistaTraslado | null>(null)
  const [errorVista, setErrorVista] = useState('')
  const [autorizaNombre, setAutorizaNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  // Vista previa al elegir la relación destino (lo que hacía el botón "Calcular" en Java)
  useEffect(() => {
    if (!form.relacion) return
    let vigente = true
    activosApi
      .vistaTraslado(activo.correlativo, Number(form.relacion))
      .then((v) => vigente && (setVista(v), setErrorVista('')))
      .catch((err) => vigente && (setVista(null), setErrorVista(textoError(err))))
    return () => {
      vigente = false
    }
  }, [activo.correlativo, form.relacion])

  async function buscarEmpleado() {
    setAutorizaNombre('')
    if (!form.autoriza) return
    try {
      setAutorizaNombre((await activosApi.empleado(Number(form.autoriza))).nombre)
    } catch (err) {
      setAutorizaNombre(`⚠ ${textoError(err)}`)
    }
  }

  async function trasladar(e: FormEvent) {
    e.preventDefault()
    if (!vista) return
    const ok = window.confirm(
      `Se creará un activo nuevo en la relación ${form.relacion} con ${vista.meses} meses de depreciación acumulada ` +
        `(${moneda(vista.depreciacionAcumulada)}) y el activo ${activo.correlativo} quedará como DEPRECIADO.\n\n¿Continuar?`,
    )
    if (!ok) return
    setError('')
    setEnviando(true)
    try {
      const r = await activosApi.trasladar(activo.correlativo, {
        relacion: Number(form.relacion),
        tipo: Number(form.tipo) as 1 | 2,
        documento: form.documento,
        fecha: form.fecha,
        autoriza: Number(form.autoriza),
        motivo: form.motivo,
      })
      onCambio()
      navigate(`/activos/${r.activoNuevo}?pestana=traslado`)
    } catch (err) {
      setError(textoError(err))
    } finally {
      setEnviando(false)
    }
  }

  const campo = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
  })

  return (
    <form className="panel form-grid" onSubmit={trasladar}>
      <p className="nota col-completa">
        Cuenta actual: <strong>{activo.cuenta}</strong> / {activo.subCuenta} / {activo.division} ({porcentaje(activo.porcentaje)})
      </p>
      <label className="col-completa">
        Relación de cuentas destino
        <select {...campo('relacion')} required>
          <option value="">{relaciones.datos ? 'Seleccione…' : 'Cargando…'}</option>
          {relaciones.datos
            ?.filter((r) => r.codigo !== activo.relacionCodigo)
            .map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {r.codigo}. {r.etiqueta} ({porcentaje(r.porcentaje)})
              </option>
            ))}
        </select>
      </label>

      {errorVista && <p className="msg-error col-completa">{errorVista}</p>}
      {vista && (
        <div className="resumen-calculo col-completa">
          <div>
            <span>Porcentaje nuevo</span>
            <strong>{porcentaje(vista.porcentaje)}</strong>
          </div>
          <div>
            <span>Depreciación mensual nueva</span>
            <strong>{moneda(vista.valorMensual)}</strong>
          </div>
          <div>
            <span>Meses trasladados</span>
            <strong>{vista.meses}</strong>
          </div>
          <div>
            <span>Acumulada en el activo nuevo</span>
            <strong>{moneda(vista.depreciacionAcumulada)}</strong>
          </div>
          <div>
            <span>Valor en libros</span>
            <strong>{moneda(vista.valorLibros)}</strong>
          </div>
          <div>
            <span>Periodo del traslado</span>
            <strong>{vista.periodo ?? '—'}</strong>
          </div>
        </div>
      )}

      <label>
        Tipo de documento
        <select {...campo('tipo')}>
          <option value="1">TRASLADO</option>
          <option value="2">AJUSTE</option>
        </select>
      </label>
      <label>
        No. de documento
        <input maxLength={200} required {...campo('documento')} />
      </label>
      <label>
        Fecha del documento
        <input type="date" required {...campo('fecha')} />
      </label>
      <label>
        Código de empleado que autoriza
        <input type="number" inputMode="numeric" min={1} step={1} required {...campo('autoriza')} onBlur={buscarEmpleado} />
        {autorizaNombre && <small className="nota">{autorizaNombre}</small>}
      </label>
      <label className="col-completa">
        Motivo del traslado
        <textarea rows={2} maxLength={400} required {...campo('motivo')} />
      </label>

      {error && <p className="msg-error col-completa">{error}</p>}
      <div className="col-completa acciones">
        <button type="submit" className="btn-primario" disabled={enviando || !vista}>
          {enviando ? 'Trasladando…' : 'Trasladar activo'}
        </button>
      </div>
    </form>
  )
}
