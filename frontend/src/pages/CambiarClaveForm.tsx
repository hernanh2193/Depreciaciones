import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'

interface Props {
  usuario: string
  claveActual?: string
  titulo: string
  onListo: () => void
  onCancelar: () => void
}

export function CambiarClaveForm({ usuario: usuarioInicial, claveActual: actualInicial = '', titulo, onListo, onCancelar }: Props) {
  const [usuario, setUsuario] = useState(usuarioInicial)
  const [claveActual, setClaveActual] = useState(actualInicial)
  const [claveNueva, setClaveNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (claveNueva !== confirmacion) {
      setError('Las claves no coinciden')
      return
    }
    setEnviando(true)
    try {
      await api<void>('/auth/cambiar-clave', {
        method: 'POST',
        body: JSON.stringify({ usuario: usuario.trim(), claveActual, claveNueva }),
      })
      onListo()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <h2>{titulo}</h2>
      <label>
        Usuario
        <input value={usuario} onChange={(e) => setUsuario(e.target.value)} maxLength={30} autoComplete="username" required />
      </label>
      {!actualInicial && (
        <label>
          Clave actual
          <input
            type="password"
            value={claveActual}
            onChange={(e) => setClaveActual(e.target.value)}
            maxLength={30}
            autoComplete="current-password"
            required
          />
        </label>
      )}
      <label>
        Nueva clave
        <input
          type="password"
          value={claveNueva}
          onChange={(e) => setClaveNueva(e.target.value)}
          minLength={8}
          maxLength={30}
          autoComplete="new-password"
          autoFocus={!!actualInicial}
          required
        />
      </label>
      <label>
        Confirmar nueva clave
        <input
          type="password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          minLength={8}
          maxLength={30}
          autoComplete="new-password"
          required
        />
      </label>
      {error && <p className="msg-error">{error}</p>}
      <button type="submit" className="btn-primario" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Cambiar clave'}
      </button>
      <button type="button" className="btn-link" onClick={onCancelar}>
        Regresar
      </button>
    </form>
  )
}
