import { useCallback, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { activosApi, NOMBRE_ESTADO_ACTIVO, type ActivoResumen, type EstadoActivo } from '../../api/activos'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useDatos } from '../../hooks/useDatos'
import { fecha, moneda } from '../../utils/formato'

const COLUMNAS: Columna<ActivoResumen>[] = [
  { titulo: 'No.', celda: (a) => a.correlativo, alinear: 'der' },
  { titulo: 'Tarjeta', celda: (a) => a.tarjeta },
  { titulo: 'Descripción', celda: (a) => <span className="texto-recortado">{a.descripcion}</span> },
  { titulo: 'Cuenta', celda: (a) => a.relacion },
  { titulo: 'Inicio', celda: (a) => fecha(a.fechaInicio) },
  { titulo: 'Valor original', celda: (a) => moneda(a.valorOriginal), alinear: 'der' },
  { titulo: 'Mensual', celda: (a) => moneda(a.valorMensual), alinear: 'der' },
  {
    titulo: 'Estado',
    celda: (a) => <span className={`badge estado-${a.estado}`}>{NOMBRE_ESTADO_ACTIVO[a.estado] ?? a.estado}</span>,
  },
]

interface Props {
  titulo: string
  descripcion: string
  /** Pestaña de la ficha que se abre al elegir un activo. */
  pestana?: 'datos' | 'otro'
}

/** Búsqueda de activos en el servidor (por número, tarjeta o texto de la descripción). */
export function BuscarActivosPage({ titulo, descripcion, pestana = 'datos' }: Props) {
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<EstadoActivo | ''>('')
  const [consulta, setConsulta] = useState({ texto: '', estado: '' as EstadoActivo | '' })

  const cargar = useCallback(() => activosApi.buscar(consulta.texto, consulta.estado), [consulta])
  const { datos, error, cargando } = useDatos(cargar)

  function buscar(e: FormEvent) {
    e.preventDefault()
    setConsulta({ texto, estado })
  }

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <h1>{titulo}</h1>
        <p className="nota">{descripcion}</p>
      </header>

      <form className="panel form-linea" onSubmit={buscar}>
        <label className="crece">
          Buscar
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Número de activo, número de tarjeta o parte de la descripción"
            maxLength={100}
            autoFocus
          />
        </label>
        <label>
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoActivo | '')}>
            <option value="">Todos</option>
            <option value="A">ACTIVO</option>
            <option value="D">DEPRECIADO</option>
            <option value="I">ANULADO</option>
          </select>
        </label>
        <button type="submit" className="btn-primario">
          Buscar
        </button>
      </form>

      <p className="nota">
        {consulta.texto ? '' : 'Mostrando los 100 activos más recientes. '}Haga clic en un activo para abrir su ficha.
      </p>
      <TablaDatos
        columnas={COLUMNAS}
        filas={datos}
        clave={(a) => a.correlativo}
        cargando={cargando}
        error={error}
        sinBuscador
        vacio="No se encontraron activos"
        onFila={(a) => navigate(`/activos/${a.correlativo}${pestana === 'otro' ? '?pestana=otro' : ''}`)}
      />
    </section>
  )
}
