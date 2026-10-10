import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { catalogosApi, type Relacion } from '../../api/catalogos'
import { puedeEditarCatalogos } from '../../auth/permisos'
import { useAuth } from '../../auth/useAuth'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useDatos } from '../../hooks/useDatos'

const COLUMNAS: Columna<Relacion>[] = [
  { titulo: 'ID', celda: (r) => r.codigo, alinear: 'der' },
  { titulo: 'Cuenta', celda: (r) => r.cuenta },
  { titulo: 'Subcuenta', celda: (r) => r.subCuenta },
  { titulo: 'División', celda: (r) => r.division ?? 'SIN DIVISIÓN' },
]

const VACIO = { cuenta: '', subCuenta: '', division: '' }

export function RelacionesPage() {
  const { usuario } = useAuth()
  const editable = puedeEditarCatalogos(usuario?.rol)
  const relaciones = useDatos(catalogosApi.relaciones)
  const opciones = useDatos(catalogosApi.opcionesRelacion)
  const [form, setForm] = useState(VACIO)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    setEnviando(true)
    try {
      await catalogosApi.crearRelacion({
        cuenta: Number(form.cuenta),
        subCuenta: Number(form.subCuenta),
        division: form.division ? Number(form.division) : null,
      })
      setMsg({ tipo: 'ok', texto: 'Relación registrada' })
      setForm(VACIO)
      relaciones.recargar()
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor' })
    } finally {
      setEnviando(false)
    }
  }

  const op = opciones.datos

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <h1>Unificar cuenta</h1>
        <p className="nota">Relaciona una cuenta principal con una subcuenta y, opcionalmente, una división.</p>
      </header>

      {editable && (
        <form className="panel form-linea" onSubmit={guardar}>
          {opciones.error && <p className="msg-error form-mensaje">{opciones.error}</p>}
          <label className="crece">
            Cuenta
            <select value={form.cuenta} onChange={(e) => setForm({ ...form, cuenta: e.target.value })} required>
              <option value="">{op ? 'Seleccione…' : 'Cargando…'}</option>
              {op?.cuentas.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="crece">
            Subcuenta
            <select value={form.subCuenta} onChange={(e) => setForm({ ...form, subCuenta: e.target.value })} required>
              <option value="">{op ? 'Seleccione…' : 'Cargando…'}</option>
              {op?.subCuentas.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="crece">
            División
            <select value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })}>
              <option value="">Sin división</option>
              {op?.divisiones.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primario" disabled={enviando || !op}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
          {msg && <p className={`form-mensaje ${msg.tipo === 'ok' ? 'msg-ok' : 'msg-error'}`}>{msg.texto}</p>}
        </form>
      )}

      <TablaDatos
        columnas={COLUMNAS}
        filas={relaciones.datos}
        clave={(r) => r.codigo}
        cargando={relaciones.cargando}
        error={relaciones.error}
      />
    </section>
  )
}
