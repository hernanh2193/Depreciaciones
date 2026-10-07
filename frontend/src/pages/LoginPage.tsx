import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { ApiError } from '../api/client'
import logo from '../assets/epq.png'
import { useAuth } from '../auth/useAuth'
import { CambiarClaveForm } from './CambiarClaveForm'

export function LoginPage() {
  const { usuario: sesion, login } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [modo, setModo] = useState<'login' | 'cambio'>('login')
  const [aviso, setAviso] = useState('')

  if (sesion) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setAviso('')
    setEnviando(true)
    try {
      const res = await login(usuario.trim(), clave)
      if (res === 'cambio-clave') setModo('cambio')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login-fondo">
      <div className="login-card">
        <header className="login-encabezado">
          <img src={logo} alt="Empresa Portuaria Quetzal" width={72} height={72} />
          <div>
            <div className="login-empresa">Empresa Portuaria Quetzal</div>
            <h1>Sistema de Depreciaciones</h1>
          </div>
        </header>

        {modo === 'cambio' ? (
          <CambiarClaveForm
            usuario={usuario.trim()}
            claveActual={clave}
            titulo={clave ? 'Debe cambiar su clave inicial' : 'Cambiar mi clave'}
            onListo={() => {
              setModo('login')
              setClave('')
              setAviso('Clave actualizada. Inicie sesión con su nueva clave.')
            }}
            onCancelar={() => {
              setModo('login')
              setClave('')
            }}
          />
        ) : (
          <form onSubmit={onSubmit} className="form">
            <label>
              Usuario
              <input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                maxLength={30}
                autoComplete="username"
                autoFocus
                required
              />
            </label>
            <label>
              Clave
              <input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                maxLength={30}
                autoComplete="current-password"
                required
              />
            </label>
            {aviso && <p className="msg-ok">{aviso}</p>}
            {error && <p className="msg-error">{error}</p>}
            <button type="submit" className="btn-primario" disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setClave('')
                setModo('cambio')
              }}
            >
              Cambiar mi clave
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
