import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { NOMBRE_ESTADO_ACTIVO, type EstadoActivo } from '../../api/activos'
import { ApiError } from '../../api/client'
import { consultasApi, type ActivoConsulta, type FiltroConsulta, type TotalesConsulta } from '../../api/consultas'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useDatos } from '../../hooks/useDatos'
import { descargarCsv } from '../../utils/csv'
import { fecha, moneda } from '../../utils/formato'

/** buscar = Buscador de activos · relacion = Consulta relación cuentas · cuenta = Consulta de cuenta x activos */
export type ModoConsulta = 'buscar' | 'relacion' | 'cuenta'

const periodo = (p: number | null) => (p ? `${String(p).slice(4)}/${String(p).slice(0, 4)}` : '')

const COLUMNAS: Columna<ActivoConsulta>[] = [
  { titulo: 'No.', celda: (a) => a.correlativo, alinear: 'der' },
  { titulo: 'Tarjeta', celda: (a) => a.tarjeta },
  { titulo: 'Descripción', celda: (a) => <span className="texto-recortado">{a.descripcion}</span> },
  {
    titulo: 'Cuenta / subcuenta / división',
    celda: (a) => (
      <small>
        {a.cuenta} · {a.subCuenta} · {a.division}
      </small>
    ),
  },
  { titulo: 'Inicio', celda: (a) => fecha(a.fechaInicio) },
  { titulo: 'Valor original', celda: (a) => moneda(a.valorOriginal), alinear: 'der' },
  { titulo: 'Mensual', celda: (a) => moneda(a.valorMensual), alinear: 'der' },
  { titulo: 'Acumulada', celda: (a) => moneda(a.depreciacionAcumulada), alinear: 'der' },
  { titulo: 'Valor en libros', celda: (a) => moneda(a.valorLibros ?? a.valorOriginal), alinear: 'der' },
  { titulo: 'Último mes', celda: (a) => periodo(a.ultimoPeriodo) },
  {
    titulo: 'Estado',
    celda: (a) => <span className={`badge estado-${a.estado}`}>{NOMBRE_ESTADO_ACTIVO[a.estado] ?? a.estado}</span>,
  },
]

const COLUMNAS_CSV: { titulo: string; valor: (a: ActivoConsulta) => unknown }[] = [
  { titulo: 'No. activo', valor: (a) => a.correlativo },
  { titulo: 'Tarjeta', valor: (a) => a.tarjeta },
  { titulo: 'Cuenta presupuestaria', valor: (a) => a.cuentaPresupuesto },
  { titulo: 'Descripción', valor: (a) => a.descripcion },
  { titulo: 'Cuenta', valor: (a) => a.cuenta },
  { titulo: 'Subcuenta', valor: (a) => a.subCuenta },
  { titulo: 'División', valor: (a) => a.division },
  { titulo: 'Fecha inicio', valor: (a) => fecha(a.fechaInicio) },
  { titulo: 'Fecha final', valor: (a) => fecha(a.fechaFinal) },
  { titulo: 'Valor original', valor: (a) => a.valorOriginal },
  { titulo: 'Depreciación mensual', valor: (a) => a.valorMensual },
  { titulo: 'Depreciación acumulada', valor: (a) => a.depreciacionAcumulada },
  { titulo: 'Valor en libros', valor: (a) => a.valorLibros ?? a.valorOriginal },
  { titulo: 'Último mes generado', valor: (a) => periodo(a.ultimoPeriodo) },
  { titulo: 'Estado', valor: (a) => NOMBRE_ESTADO_ACTIVO[a.estado] ?? a.estado },
  { titulo: 'No. constancia', valor: (a) => a.noConstancia },
]

const VACIO: FiltroConsulta = { texto: '', estado: '', cuenta: '', relacion: '' }

interface Props {
  modo: ModoConsulta
  titulo: string
  descripcion: string
}

export function ConsultaActivosPage({ modo, titulo, descripcion }: Props) {
  const navigate = useNavigate()
  const opciones = useDatos(consultasApi.opciones)
  const [filtro, setFiltro] = useState<FiltroConsulta>(VACIO)
  const [resultado, setResultado] = useState<{ filas: ActivoConsulta[]; totales: TotalesConsulta } | null>(null)
  // El buscador carga resultados de inicio (como en Java); las otras consultas esperan la cuenta o relación
  const [cargando, setCargando] = useState(modo === 'buscar')
  const [error, setError] = useState('')
  const limite = modo === 'buscar' ? 500 : 5000

  async function consultar(f: FiltroConsulta) {
    setError('')
    setCargando(true)
    try {
      setResultado(await consultasApi.activos(f, limite))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (modo !== 'buscar') return
    let vigente = true
    consultasApi
      .activos(VACIO, limite)
      .then((r) => vigente && setResultado(r))
      .catch((err) => vigente && setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor'))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [modo, limite])

  function enviar(e: FormEvent) {
    e.preventDefault()
    void consultar(filtro)
  }

  const relaciones = opciones.datos?.relaciones.filter((r) => !filtro.cuenta || String(r.cuenta) === filtro.cuenta) ?? []
  const t = resultado?.totales

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <h1>{titulo}</h1>
        <p className="nota">{descripcion}</p>
      </header>

      <form className="panel form-linea" onSubmit={enviar}>
        {modo === 'buscar' && (
          <label className="crece">
            Buscar
            <input
              type="search"
              value={filtro.texto}
              onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })}
              placeholder="Número de activo, número de tarjeta o parte de la descripción"
              maxLength={100}
              autoFocus
            />
          </label>
        )}
        <label className={modo === 'buscar' ? '' : 'crece'}>
          Cuenta
          <select
            value={filtro.cuenta}
            onChange={(e) => setFiltro({ ...filtro, cuenta: e.target.value, relacion: '' })}
            required={modo === 'cuenta'}
          >
            <option value="">{modo === 'cuenta' ? 'Seleccione…' : 'Todas'}</option>
            {opciones.datos?.cuentas.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
        {modo !== 'cuenta' && (
          <label className="crece">
            Relación de cuentas
            <select
              value={filtro.relacion}
              onChange={(e) => setFiltro({ ...filtro, relacion: e.target.value })}
              required={modo === 'relacion'}
            >
              <option value="">{modo === 'relacion' ? 'Seleccione…' : 'Todas'}</option>
              {relaciones.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Estado
          <select value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value as EstadoActivo | '' })}>
            <option value="">Todos</option>
            <option value="A">ACTIVO</option>
            <option value="D">DEPRECIADO</option>
            <option value="I">ANULADO</option>
          </select>
        </label>
        <button type="submit" className="btn-primario" disabled={cargando}>
          {cargando ? 'Consultando…' : 'Consultar'}
        </button>
      </form>

      {error && <p className="msg-error">{error}</p>}

      {t && (
        <div className="tarjetas">
          <div className="tarjeta">
            <span className="tarjeta-titulo">Activos</span>
            <div className="tarjeta-valor">{t.activos.toLocaleString('es-GT')}</div>
          </div>
          <div className="tarjeta">
            <span className="tarjeta-titulo">Valor original</span>
            <div className="tarjeta-valor">{moneda(t.valorOriginal)}</div>
          </div>
          <div className="tarjeta">
            <span className="tarjeta-titulo">Depreciación mensual</span>
            <div className="tarjeta-valor">{moneda(t.valorMensual)}</div>
          </div>
          <div className="tarjeta">
            <span className="tarjeta-titulo">Depreciación acumulada</span>
            <div className="tarjeta-valor">{moneda(t.depreciacionAcumulada)}</div>
          </div>
          <div className="tarjeta">
            <span className="tarjeta-titulo">Valor en libros</span>
            <div className="tarjeta-valor">{moneda(t.valorLibros)}</div>
          </div>
        </div>
      )}

      {resultado && (
        <div className="form-linea" style={{ padding: 0 }}>
          <p className="nota crece" style={{ margin: 0 }}>
            {resultado.filas.length < (t?.activos ?? 0)
              ? `Se muestran los primeros ${resultado.filas.length} de ${t?.activos.toLocaleString('es-GT')} activos; los totales incluyen todos. Use los filtros para acotar.`
              : 'Haga clic en un activo para ver su depreciación mes a mes.'}{' '}
            La depreciación acumulada es la del último mes generado de cada activo.
          </p>
          <button
            type="button"
            className="btn-secundario"
            onClick={() => descargarCsv(`activos-${modo}-${new Date().toISOString().slice(0, 10)}`, COLUMNAS_CSV, resultado.filas)}
            disabled={!resultado.filas.length}
          >
            Descargar CSV
          </button>
        </div>
      )}

      {(resultado || cargando) && (
        <TablaDatos
          columnas={COLUMNAS}
          filas={resultado?.filas ?? null}
          clave={(a) => a.correlativo}
          cargando={cargando && !resultado}
          vacio="No se encontraron activos"
          onFila={(a) => navigate(`/consultas/activo/${a.correlativo}`)}
        />
      )}
    </section>
  )
}
