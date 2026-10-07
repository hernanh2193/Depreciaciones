import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  activosApi,
  NOMBRE_ESTADO_ACTIVO,
  type Activo,
  type DetalleDepreciacion,
  type EstadoActivo,
  type OtroPorcentaje,
} from '../../api/activos'
import { ApiError } from '../../api/client'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useDatos } from '../../hooks/useDatos'
import { fecha, moneda, porcentaje } from '../../utils/formato'
import { CamposActivo } from './CamposActivo'
import { aDatos, desdeActivo, type FormActivo } from './formActivo'

type Pestana = 'datos' | 'depreciacion' | 'otro'
type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null

const textoError = (err: unknown) => (err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')

export function ActivoDetallePage() {
  const id = Number(useParams().id)
  const [params, setParams] = useSearchParams()
  const pestana = (params.get('pestana') as Pestana) || 'datos'
  const cargar = useCallback(() => activosApi.obtener(id), [id])
  const { datos: activo, error, cargando, recargar } = useDatos(cargar)

  if (!Number.isInteger(id)) return <p className="msg-error">Número de activo no válido</p>

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <p className="nota">
          <Link to="/activos/modificacion">← Buscar otro activo</Link>
        </p>
        <h1>Activo {id}</h1>
        {activo && <p className="nota texto-recortado-2">{activo.descripcion}</p>}
      </header>

      {cargando && <p className="cargando">Cargando…</p>}
      {error && <p className="msg-error">{error}</p>}

      {activo && (
        <>
          <Resumen activo={activo} />
          <nav className="pestanas" role="tablist">
            {(
              [
                ['datos', 'Datos'],
                ['depreciacion', `Depreciación (${activo.mesesGenerados} meses)`],
                ['otro', `Otro porcentaje${activo.tieneOtroPorcentaje ? ' ●' : ''}`],
              ] as [Pestana, string][]
            ).map(([clave, titulo]) => (
              <button
                key={clave}
                role="tab"
                aria-selected={pestana === clave}
                className={pestana === clave ? 'activa' : ''}
                onClick={() => setParams({ pestana: clave }, { replace: true })}
              >
                {titulo}
              </button>
            ))}
          </nav>
          {pestana === 'datos' && <PestanaDatos key={activo.fechaMod ?? ''} activo={activo} onCambio={recargar} />}
          {pestana === 'depreciacion' && <PestanaDepreciacion activo={activo} onCambio={recargar} />}
          {pestana === 'otro' && <PestanaOtro activo={activo} onCambio={recargar} />}
        </>
      )}
    </section>
  )
}

function Resumen({ activo: a }: { activo: Activo }) {
  return (
    <div className="tarjetas">
      <Dato titulo="Estado">
        <span className={`badge estado-${a.estado}`}>{NOMBRE_ESTADO_ACTIVO[a.estado] ?? a.estado}</span>
      </Dato>
      <Dato titulo="Valor original">{moneda(a.valorOriginal)}</Dato>
      <Dato titulo="Depreciación mensual">
        {moneda(a.valorMensual)}
        <small>
          {porcentaje(a.porcentaje)} anual · factor {a.factor}
        </small>
      </Dato>
      <Dato titulo="Depreciación acumulada">{moneda(a.depreciacionAcumulada)}</Dato>
      <Dato titulo="Valor en libros">{a.valorLibros === null ? '—' : moneda(a.valorLibros)}</Dato>
      <Dato titulo="Cuenta">
        <small>{a.cuenta}</small>
        <small>{a.subCuenta}</small>
        <small>{a.division}</small>
      </Dato>
    </div>
  )
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="tarjeta">
      <span className="tarjeta-titulo">{titulo}</span>
      <div className="tarjeta-valor">{children}</div>
    </div>
  )
}

// ---------------- Datos ----------------

function PestanaDatos({ activo, onCambio }: { activo: Activo; onCambio: () => void }) {
  const [form, setForm] = useState<FormActivo>(() => desdeActivo(activo))
  const [estado, setEstado] = useState<EstadoActivo>(activo.estado)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<Mensaje>(null)
  const [sugerirRegenerar, setSugerirRegenerar] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    setEnviando(true)
    try {
      const r = await activosApi.actualizar(activo.correlativo, { ...aDatos(form), estado })
      setSugerirRegenerar(r.regenerarSugerido)
      setMsg({ tipo: 'ok', texto: `Cambios guardados. Depreciación mensual: ${moneda(r.valorMensual)}` })
      onCambio()
    } catch (err) {
      setMsg({ tipo: 'error', texto: textoError(err) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="panel form-grid" onSubmit={guardar}>
      <label>
        Estado
        <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoActivo)}>
          <option value="A">ACTIVO</option>
          <option value="D">DEPRECIADO</option>
          <option value="I">ANULADO</option>
        </select>
      </label>
      <CamposActivo form={form} onChange={setForm} />
      <p className="nota col-completa">
        El factor y la depreciación mensual solo se recalculan si cambia el valor original. Registrado por{' '}
        {activo.usuarioCrea} el {fecha(activo.fechaCrea)}
        {activo.usuarioMod && ` · modificado por ${activo.usuarioMod} el ${fecha(activo.fechaMod)}`}.
      </p>
      {msg && <p className={`col-completa ${msg.tipo === 'ok' ? 'msg-ok' : 'msg-error'}`}>{msg.texto}</p>}
      {sugerirRegenerar && (
        <p className="aviso col-completa">
          Cambió el valor o la fecha de inicio, pero el detalle de depreciación ya generado no se actualiza solo. Vaya a
          la pestaña <strong>Depreciación</strong> y presione <strong>Regenerar</strong>.
        </p>
      )}
      <div className="col-completa acciones">
        <button type="submit" className="btn-primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

// ---------------- Depreciación ----------------

const COLUMNAS_DETALLE: Columna<DetalleDepreciacion>[] = [
  { titulo: 'No.', celda: (d) => d.correlativo, alinear: 'der' },
  { titulo: 'Periodo', celda: (d) => d.periodo },
  { titulo: 'Mes', celda: (d) => d.descripcion },
  { titulo: 'Saldo inicial', celda: (d) => moneda(d.saldoInicial), alinear: 'der' },
  { titulo: 'Factor', celda: (d) => d.factor, alinear: 'der' },
  { titulo: 'Depreciación mes', celda: (d) => moneda(d.depreciacionMes), alinear: 'der' },
  { titulo: 'Acumulada', celda: (d) => moneda(d.depreciacionAcumulada), alinear: 'der' },
  { titulo: 'Valor en libros', celda: (d) => moneda(d.valorLibros), alinear: 'der' },
  { titulo: 'Observación', celda: (d) => d.observaciones },
]

function PestanaDepreciacion({ activo, onCambio }: { activo: Activo; onCambio: () => void }) {
  const id = activo.correlativo
  const cargar = useCallback(() => activosApi.detalle(id), [id])
  const detalle = useDatos(cargar)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<Mensaje>(null)

  async function regenerar() {
    const ok = window.confirm(
      `Se borrarán los ${activo.mesesGenerados} meses de depreciación del activo ${id} y se volverán a calcular ` +
        `desde ${fecha(activo.fechaInicio)} hasta el mes actual. Si el cálculo falla, se conserva el detalle actual.\n\n¿Continuar?`,
    )
    if (!ok) return
    setMsg(null)
    setEnviando(true)
    try {
      const a = await activosApi.regenerar(id)
      setMsg({ tipo: 'ok', texto: `Depreciación regenerada: ${a.mesesGenerados} meses` })
      detalle.recargar()
      onCambio()
    } catch (err) {
      setMsg({ tipo: 'error', texto: textoError(err) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <div className="panel form-linea">
        <p className="nota crece" style={{ margin: 0 }}>
          {activo.tieneOtroPorcentaje
            ? 'Este activo tiene un tramo con otro porcentaje: para regenerarlo use la pestaña "Otro porcentaje".'
            : 'Regenerar borra el detalle y lo vuelve a calcular con el procedimiento DEP_GENERACION_MES.'}
        </p>
        <button
          type="button"
          className="btn-secundario"
          onClick={regenerar}
          disabled={enviando || activo.tieneOtroPorcentaje || activo.estado === 'I'}
        >
          {enviando ? 'Regenerando…' : 'Regenerar depreciación'}
        </button>
        {msg && <p className={`form-mensaje ${msg.tipo === 'ok' ? 'msg-ok' : 'msg-error'}`}>{msg.texto}</p>}
      </div>
      <TablaDatos
        columnas={COLUMNAS_DETALLE}
        filas={detalle.datos}
        clave={(d) => d.correlativo}
        cargando={detalle.cargando}
        error={detalle.error}
        vacio="Este activo no tiene depreciación generada"
      />
    </div>
  )
}

// ---------------- Otro porcentaje ----------------

const COLUMNAS_OTRO: Columna<OtroPorcentaje>[] = [
  { titulo: 'Desde', celda: (o) => fecha(o.fechaInicio) },
  { titulo: 'Hasta', celda: (o) => fecha(o.fechaFinal) },
  { titulo: 'Valor original', celda: (o) => moneda(o.valorOriginal), alinear: 'der' },
  { titulo: 'Valor mensual', celda: (o) => moneda(o.valorMensual), alinear: 'der' },
  { titulo: 'Factor', celda: (o) => o.factor, alinear: 'der' },
]

const TRAMO_VACIO = { valorOriginal: '', valorMensual: '', factor: '', fechaInicio: '', fechaFinal: '' }

function PestanaOtro({ activo, onCambio }: { activo: Activo; onCambio: () => void }) {
  const id = activo.correlativo
  const cargar = useCallback(() => activosApi.otrosPorcentajes(id), [id])
  const tramos = useDatos(cargar)
  const [form, setForm] = useState(TRAMO_VACIO)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<Mensaje>(null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    setEnviando(true)
    try {
      await activosApi.crearOtroPorcentaje(id, {
        valorOriginal: Number(form.valorOriginal),
        valorMensual: Number(form.valorMensual),
        factor: Number(form.factor),
        fechaInicio: form.fechaInicio,
        fechaFinal: form.fechaFinal,
      })
      setMsg({ tipo: 'ok', texto: 'Tramo registrado. Ahora puede regenerar la depreciación.' })
      setForm(TRAMO_VACIO)
      tramos.recargar()
      onCambio()
    } catch (err) {
      setMsg({ tipo: 'error', texto: textoError(err) })
    } finally {
      setEnviando(false)
    }
  }

  async function regenerar() {
    const ok = window.confirm(
      `Se borrará el detalle de depreciación del activo ${id} y se volverá a calcular con el otro porcentaje ` +
        `(procedimiento DEP_GENERACION_PORCANT). Si el cálculo falla, se conserva el detalle actual.\n\n¿Continuar?`,
    )
    if (!ok) return
    setMsg(null)
    setEnviando(true)
    try {
      const a = await activosApi.regenerarConOtroPorcentaje(id)
      setMsg({ tipo: 'ok', texto: `Depreciación regenerada con otro porcentaje: ${a.mesesGenerados} meses` })
      onCambio()
    } catch (err) {
      setMsg({ tipo: 'error', texto: textoError(err) })
    } finally {
      setEnviando(false)
    }
  }

  const hayTramo = (tramos.datos?.length ?? 0) > 0
  const campo = (k: keyof typeof TRAMO_VACIO) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
  })

  return (
    <div className="pagina">
      <p className="nota">
        Un tramo con otro porcentaje aplica un valor mensual distinto durante un rango de fechas (por ejemplo, un
        porcentaje anterior). Cada activo admite un solo tramo.
      </p>
      <TablaDatos
        columnas={COLUMNAS_OTRO}
        filas={tramos.datos}
        clave={(o) => o.correlativo}
        cargando={tramos.cargando}
        error={tramos.error}
        sinBuscador
        vacio="Este activo no tiene tramos con otro porcentaje"
      />

      {!hayTramo && tramos.datos && (
        <form className="panel form-grid" onSubmit={guardar}>
          <label>
            Desde
            <input type="date" required {...campo('fechaInicio')} />
          </label>
          <label>
            Hasta
            <input type="date" required {...campo('fechaFinal')} />
          </label>
          <label>
            Valor original (Q)
            <input type="number" inputMode="decimal" min={0.01} step={0.01} required {...campo('valorOriginal')} />
          </label>
          <label>
            Valor mensual (Q)
            <input type="number" inputMode="decimal" min={0.01} step={0.01} required {...campo('valorMensual')} />
          </label>
          <label>
            Factor
            <input type="number" inputMode="decimal" min={0.000001} max={1} step={0.000001} required {...campo('factor')} />
          </label>
          <div className="col-completa acciones">
            <button type="submit" className="btn-primario" disabled={enviando}>
              Guardar tramo
            </button>
          </div>
        </form>
      )}

      {hayTramo && (
        <div className="panel form-linea">
          <p className="nota crece" style={{ margin: 0 }}>
            Regenera todo el detalle aplicando el tramo con otro porcentaje.
          </p>
          <button
            type="button"
            className="btn-secundario"
            onClick={regenerar}
            disabled={enviando || activo.estado === 'I'}
          >
            {enviando ? 'Regenerando…' : 'Regenerar con otro porcentaje'}
          </button>
        </div>
      )}
      {msg && <p className={msg.tipo === 'ok' ? 'msg-ok' : 'msg-error'}>{msg.texto}</p>}
    </div>
  )
}
