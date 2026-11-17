import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { procesosApi, type EstadoPonerAlDia, type VistaPonerAlDia } from '../../api/procesos'

const textoError = (err: unknown) => (err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
const periodoTexto = (p: number) => `${String(p).slice(4)}/${String(p).slice(0, 4)}`
const miles = (n: number) => n.toLocaleString('es-GT')

interface Props {
  cuenta: number
  onCerrar: () => void
  onTerminado: () => void
}

/**
 * "Poner al día" una cuenta: genera los meses faltantes de cada activo en estado ACTIVO hasta el periodo vigente.
 * Corre en segundo plano en el servidor; aquí se consulta el avance cada 2 segundos.
 */
export function PonerAlDiaPanel({ cuenta, onCerrar, onTerminado }: Props) {
  const [vista, setVista] = useState<VistaPonerAlDia | null>(null)
  const [estado, setEstado] = useState<EstadoPonerAlDia | null>(null)
  const [error, setError] = useState('')

  // Vista previa y, si ya hay un trabajo de esta cuenta (en curso o terminado), su estado
  useEffect(() => {
    let vigente = true
    procesosApi
      .vistaPonerAlDia(cuenta)
      .then((v) => vigente && setVista(v))
      .catch((err) => vigente && setError(textoError(err)))
    procesosApi
      .estadoPonerAlDia()
      .then((e) => vigente && e?.cuenta === cuenta && setEstado(e))
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [cuenta])

  // Consultar el avance mientras el trabajo siga corriendo
  const corriendo = !!estado && !estado.fin
  useEffect(() => {
    if (!corriendo) return
    const id = setInterval(async () => {
      try {
        const e = await procesosApi.estadoPonerAlDia()
        if (!e) return
        setEstado(e)
        if (e.fin) onTerminado()
      } catch {
        /* reintenta en el siguiente ciclo */
      }
    }, 2000)
    return () => clearInterval(id)
  }, [corriendo, onTerminado])

  async function iniciar() {
    if (!vista) return
    const ok = window.confirm(
      `Se generarán aproximadamente ${miles(vista.mesesEstimados)} meses de depreciación en la cuenta ${cuenta} ` +
        `hasta ${periodoTexto(vista.periodoActual)}.\n\n` +
        'Puede tardar varios minutos. No se puede deshacer desde el sistema; asegúrese de tener respaldo.\n\n¿Continuar?',
    )
    if (!ok) return
    setError('')
    try {
      setEstado(await procesosApi.iniciarPonerAlDia(cuenta))
    } catch (err) {
      setError(textoError(err))
    }
  }

  const pct = estado && estado.total ? Math.round((estado.avance / estado.total) * 100) : 0

  return (
    <div className="panel pagina">
      <div className="form-linea" style={{ padding: 0 }}>
        <h2 className="crece" style={{ margin: 0 }}>
          Poner al día la cuenta {cuenta}
        </h2>
        <button type="button" className="btn-link" onClick={onCerrar} disabled={corriendo}>
          Cerrar
        </button>
      </div>

      {error && <p className="msg-error">{error}</p>}
      {!vista && !error && <p className="cargando">Analizando activos…</p>}

      {vista && !estado && (
        <>
          <p className="nota">
            Deja a cada activo en estado ACTIVO con todos sus meses generados hasta{' '}
            <strong>{periodoTexto(vista.periodoActual)}</strong>, sin saltos:
          </p>
          <ol className="nota">
            <li>
              <strong>{vista.sinDetalle.length}</strong> activos sin depreciación se generan completos desde su fecha de
              inicio (igual que al registrarlos).
            </li>
            <li>
              <strong>{vista.atrasados.length}</strong> activos con meses faltantes se completan procesando{' '}
              <strong>{vista.periodos.length}</strong> periodos en orden
              {vista.periodos.length > 0 &&
                ` (${periodoTexto(vista.periodos[0])} a ${periodoTexto(vista.periodos[vista.periodos.length - 1])})`}
              ; cada activo recibe solo los meses que le faltan.
            </li>
          </ol>
          <p>
            Se generarán aproximadamente <strong>{miles(vista.mesesEstimados)}</strong> meses de depreciación. Los activos
            que lleguen al final de su vida útil pasarán a DEPRECIADO.
          </p>
          {vista.bloqueos.map((b) => (
            <p key={b} className="msg-error">
              {b}
            </p>
          ))}
          <div className="acciones">
            <button
              type="button"
              className="btn-primario"
              onClick={iniciar}
              disabled={vista.bloqueos.length > 0 || (!vista.sinDetalle.length && !vista.periodos.length)}
            >
              {!vista.sinDetalle.length && !vista.periodos.length ? 'La cuenta ya está al día' : 'Poner al día'}
            </button>
          </div>
        </>
      )}

      {estado && (
        <>
          <div className="progreso" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="progreso-barra" style={{ width: `${pct}%` }} />
          </div>
          <p className="nota">
            {estado.fase === 'sin-detalle' && 'Paso 1 de 2: activos sin depreciación. '}
            {estado.fase === 'mensual' && 'Paso 2 de 2: meses faltantes. '}
            {estado.avance} de {estado.total} ({pct} %) · {estado.detalle}
          </p>
          {estado.fase === 'terminado' && (
            <p className="msg-ok">
              Cuenta {estado.cuenta} al día: {estado.activosCompletados} activos sin depreciación generados y{' '}
              {estado.periodosProcesados} periodos procesados.
            </p>
          )}
          {estado.errores.length > 0 && (
            <div className="msg-error">
              {estado.fase === 'error' ? 'El proceso se detuvo. ' : ''}
              Lo ya generado quedó guardado; puede volver a ejecutar "Poner al día" para continuar.
              <ul className="lista-aviso">
                {estado.errores.slice(0, 10).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
