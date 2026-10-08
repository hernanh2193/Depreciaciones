import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/client'
import {
  NOMBRE_CATEGORIA,
  procesosApi,
  type ActivoProceso,
  type CategoriaProceso,
  type ResultadoProceso,
  type VistaProceso,
} from '../../api/procesos'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useDatos } from '../../hooks/useDatos'
import { fecha, moneda } from '../../utils/formato'

const textoError = (err: unknown) => (err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
const periodoTexto = (p: number | null) => (p ? `${String(p).slice(4)}/${String(p).slice(0, 4)}` : '—')

const CLASE_CATEGORIA: Record<CategoriaProceso, string> = {
  NORMAL: 'estado-A',
  SALTO: 'badge-alerta',
  SIN_DETALLE: 'badge-azul',
  MENSUAL_CERO: 'estado-I',
}

const COLUMNAS: Columna<ActivoProceso>[] = [
  { titulo: 'No.', celda: (a) => <Link to={`/activos/${a.correlativo}?pestana=depreciacion`}>{a.correlativo}</Link>, alinear: 'der' },
  { titulo: 'Descripción', celda: (a) => <span className="texto-recortado">{a.descripcion}</span> },
  { titulo: 'Inicio', celda: (a) => fecha(a.fechaInicio) },
  { titulo: 'Mensual', celda: (a) => moneda(a.valorMensual), alinear: 'der' },
  { titulo: 'Último mes generado', celda: (a) => periodoTexto(a.ultimoPeriodo) },
  { titulo: 'Meses', celda: (a) => a.mesesGenerados, alinear: 'der' },
  {
    titulo: 'Situación',
    celda: (a) => (
      <>
        <span className={`badge ${CLASE_CATEGORIA[a.categoria]}`}>
          {NOMBRE_CATEGORIA[a.categoria]}
          {a.categoria === 'SALTO' && ` (${a.mesesSalto} meses)`}
        </span>{' '}
        {a.ultimoMes && <span className="badge badge-gris">último mes</span>}
      </>
    ),
  },
]

/** "Generar depreciación" (ProcGenera.zul → DEP_GENERACION_MENSUAL), con vista previa obligatoria. */
export function GenerarDepreciacionPage() {
  const resumen = useDatos(procesosApi.resumen)
  const [cuenta, setCuenta] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [vista, setVista] = useState<VistaProceso | null>(null)
  const [filtro, setFiltro] = useState<CategoriaProceso | ''>('')
  const [aceptado, setAceptado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const filas = useMemo(
    () => (vista ? (filtro ? vista.activos.filter((a) => a.categoria === filtro) : vista.activos) : null),
    [vista, filtro],
  )

  async function verVista(c = cuenta, p = periodo) {
    setMsg(null)
    setVista(null)
    setAceptado(false)
    setFiltro('')
    setCargando(true)
    try {
      setVista(await procesosApi.vista(Number(c), Number(p)))
    } catch (err) {
      setMsg({ tipo: 'error', texto: textoError(err) })
    } finally {
      setCargando(false)
    }
  }

  function enviarConsulta(e: FormEvent) {
    e.preventDefault()
    verVista()
  }

  function elegir(c: number, p: number | null) {
    setCuenta(String(c))
    setPeriodo(p ? String(p) : '')
    if (p) verVista(String(c), String(p))
  }

  async function generar() {
    if (!vista) return
    const ok = window.confirm(
      `Se generará la depreciación de ${periodoTexto(vista.periodo.codigo)} para ${vista.totales.activos} activos de la ` +
        `cuenta ${vista.cuenta}. Esta operación no se puede deshacer desde el sistema.\n\n¿Continuar?`,
    )
    if (!ok) return
    setMsg(null)
    setCargando(true)
    try {
      const r: ResultadoProceso = await procesosApi.generar(vista.cuenta, vista.periodo.codigo, aceptado)
      setMsg({
        tipo: 'ok',
        texto:
          `Depreciación generada: ${r.mesesGenerados} de ${r.esperados} activos` +
          (r.activosTerminados ? `; ${r.activosTerminados} terminaron su vida útil (DEPRECIADO)` : '') +
          '.',
      })
      resumen.recargar()
      setVista(await procesosApi.vista(vista.cuenta, vista.periodo.codigo))
    } catch (err) {
      setMsg({ tipo: 'error', texto: textoError(err) })
    } finally {
      setCargando(false)
    }
  }

  const puedeGenerar = !!vista && vista.bloqueos.length === 0 && (vista.advertencias.length === 0 || aceptado)

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <h1>Generar depreciación</h1>
        <p className="nota">
          Agrega el mes indicado a la depreciación de los activos en estado ACTIVO de una cuenta (procedimiento
          DEP_GENERACION_MENSUAL). Revise la vista previa antes de ejecutar: los periodos deben procesarse en orden.
        </p>
      </header>

      <TablaDatos
        columnas={[
          { titulo: 'Cuenta', celda: (r) => `${r.cuenta} - ${r.descripcion}` },
          { titulo: 'Activos en estado ACTIVO', celda: (r) => r.activos, alinear: 'der' },
          { titulo: 'Último mes generado', celda: (r) => periodoTexto(r.ultimoPeriodo) },
          { titulo: 'Siguiente', celda: (r) => periodoTexto(r.siguientePeriodo) },
          {
            titulo: '',
            celda: (r) => (
              <button type="button" className="btn-link" onClick={() => elegir(r.cuenta, r.siguientePeriodo)}>
                Revisar siguiente
              </button>
            ),
          },
        ]}
        filas={resumen.datos}
        clave={(r) => r.cuenta}
        cargando={resumen.cargando}
        error={resumen.error}
        sinBuscador
      />

      <form className="panel form-linea" onSubmit={enviarConsulta}>
        <label className="crece">
          Cuenta
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} required>
            <option value="">Seleccione…</option>
            {resumen.datos?.map((r) => (
              <option key={r.cuenta} value={r.cuenta}>
                {r.cuenta} - {r.descripcion}
              </option>
            ))}
          </select>
        </label>
        <label>
          Periodo (AAAAMM)
          <input
            type="number"
            inputMode="numeric"
            min={190001}
            max={299912}
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn-secundario" disabled={cargando}>
          Ver vista previa
        </button>
      </form>

      {msg && <p className={msg.tipo === 'ok' ? 'msg-ok' : 'msg-error'}>{msg.texto}</p>}
      {cargando && <p className="cargando">Procesando…</p>}

      {vista && (
        <>
          <div className="tarjetas">
            <Total titulo={`Activos a procesar · ${periodoTexto(vista.periodo.codigo)}`} valor={vista.totales.activos} />
            <Total titulo="Normales" valor={vista.totales.NORMAL} onClick={() => setFiltro('NORMAL')} />
            <Total titulo="Con salto" valor={vista.totales.SALTO} alerta onClick={() => setFiltro('SALTO')} />
            <Total titulo="Sin detalle" valor={vista.totales.SIN_DETALLE} alerta onClick={() => setFiltro('SIN_DETALLE')} />
            <Total titulo="Mensual 0" valor={vista.totales.MENSUAL_CERO} alerta onClick={() => setFiltro('MENSUAL_CERO')} />
            <Total titulo="Terminan vida útil" valor={vista.totales.terminan} />
          </div>

          {vista.bloqueos.map((b) => (
            <p key={b} className="msg-error">
              {b}
            </p>
          ))}
          {vista.advertencias.length > 0 && (
            <div className="aviso">
              <ul className="lista-aviso">
                {vista.advertencias.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <label className="check">
                <input type="checkbox" checked={aceptado} onChange={(e) => setAceptado(e.target.checked)} />
                Entiendo y deseo generar de todas formas
              </label>
            </div>
          )}

          <div className="panel form-linea">
            <label>
              Mostrar
              <select value={filtro} onChange={(e) => setFiltro(e.target.value as CategoriaProceso | '')}>
                <option value="">Todos</option>
                {(Object.keys(NOMBRE_CATEGORIA) as CategoriaProceso[]).map((c) => (
                  <option key={c} value={c}>
                    {NOMBRE_CATEGORIA[c]}
                  </option>
                ))}
              </select>
            </label>
            <span className="crece" />
            <button type="button" className="btn-primario" onClick={generar} disabled={!puedeGenerar || cargando}>
              Generar depreciación de {periodoTexto(vista.periodo.codigo)}
            </button>
          </div>

          <TablaDatos columnas={COLUMNAS} filas={filas} clave={(a) => a.correlativo} vacio="Sin activos en esta categoría" />
        </>
      )}
    </section>
  )
}

function Total({ titulo, valor, alerta, onClick }: { titulo: string; valor: number; alerta?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={`tarjeta tarjeta-boton ${alerta && valor > 0 ? 'tarjeta-alerta' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="tarjeta-titulo">{titulo}</span>
      <span className="tarjeta-valor">{valor}</span>
    </button>
  )
}
