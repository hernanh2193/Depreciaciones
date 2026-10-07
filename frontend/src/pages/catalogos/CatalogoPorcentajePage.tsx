import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import type { NuevoRegistroPorcentaje } from '../../api/catalogos'
import { puedeEditarCatalogos } from '../../auth/permisos'
import { useAuth } from '../../auth/useAuth'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useDatos } from '../../hooks/useDatos'
import { porcentaje } from '../../utils/formato'

interface Registro {
  codigo: number
  descripcion: string
  porcentaje: number
  correlativo?: number
}

export interface ConfigCatalogo<T extends Registro> {
  titulo: string
  descripcion: string
  /** Nombre en singular para mensajes: "la cuenta", "la subcuenta"... */
  nombre: string
  listar: () => Promise<T[]>
  crear: (r: NuevoRegistroPorcentaje) => Promise<void>
  maxCodigo: number
  maxDescripcion: number
  /** Decimales permitidos en el porcentaje (0 = entero). */
  decimales: 0 | 2
  /** Mostrar la columna "ID" (correlativo interno). */
  conCorrelativo: boolean
}

const VACIO = { codigo: '', descripcion: '', porcentaje: '' }

export function CatalogoPorcentajePage<T extends Registro>({ config }: { config: ConfigCatalogo<T> }) {
  const { usuario } = useAuth()
  const editable = puedeEditarCatalogos(usuario?.rol)
  const { datos, error, cargando, recargar } = useDatos(config.listar)
  const [form, setForm] = useState(VACIO)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const columnas: Columna<T>[] = [
    ...(config.conCorrelativo ? [{ titulo: 'ID', celda: (r: T) => r.correlativo, alinear: 'der' as const }] : []),
    { titulo: 'Código', celda: (r) => r.codigo, alinear: 'der' },
    { titulo: 'Descripción', celda: (r) => r.descripcion },
    { titulo: 'Porcentaje', celda: (r) => porcentaje(r.porcentaje), alinear: 'der' },
  ]

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    setEnviando(true)
    try {
      await config.crear({
        codigo: Number(form.codigo),
        descripcion: form.descripcion.trim(),
        porcentaje: Number(form.porcentaje),
      })
      setMsg({ tipo: 'ok', texto: `Se registró ${config.nombre} ${form.codigo}` })
      setForm(VACIO)
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
        <h1>{config.titulo}</h1>
        <p className="nota">{config.descripcion}</p>
      </header>

      {editable && (
        <form className="panel form-linea" onSubmit={guardar}>
          <label>
            Código
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={config.maxCodigo}
              step={1}
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              required
            />
          </label>
          <label className="crece">
            Descripción
            <input
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              maxLength={config.maxDescripcion}
              required
            />
          </label>
          <label>
            Porcentaje
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={config.decimales === 0 ? 1 : 0.01}
              value={form.porcentaje}
              onChange={(e) => setForm({ ...form, porcentaje: e.target.value })}
              required
            />
          </label>
          <button type="submit" className="btn-primario" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
          {msg && <p className={`form-mensaje ${msg.tipo === 'ok' ? 'msg-ok' : 'msg-error'}`}>{msg.texto}</p>}
        </form>
      )}

      <TablaDatos
        columnas={columnas}
        filas={datos}
        clave={(r) => r.correlativo ?? r.codigo}
        cargando={cargando}
        error={error}
      />
    </section>
  )
}
