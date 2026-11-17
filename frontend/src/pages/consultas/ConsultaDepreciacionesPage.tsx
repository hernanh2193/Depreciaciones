import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

/** Consulta de depreciaciones (ConsulDeprecia.zul): se ingresa el número de activo y se abre su detalle. */
export function ConsultaDepreciacionesPage() {
  const navigate = useNavigate()
  const [numero, setNumero] = useState('')

  function abrir(e: FormEvent) {
    e.preventDefault()
    navigate(`/consultas/activo/${Number(numero)}`)
  }

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <h1>Consulta de depreciaciones</h1>
        <p className="nota">
          Ingrese el número de activo para ver sus datos y su depreciación mes a mes. Si no conoce el número, use el
          Buscador de activos.
        </p>
      </header>
      <form className="panel form-linea" onSubmit={abrir}>
        <label>
          No. de activo
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            required
            autoFocus
          />
        </label>
        <button type="submit" className="btn-primario">
          Consultar
        </button>
      </form>
    </section>
  )
}
