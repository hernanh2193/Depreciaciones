import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, setOnUnauthorized, tokenStorage } from '../api/client'
import type { LoginResultado, UsuarioSesion } from './types'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  // Si hay token guardado, hay que validarlo con /auth/me antes de mostrar la app
  const [cargando, setCargando] = useState(() => tokenStorage.get() !== null)

  const logout = useCallback(() => {
    tokenStorage.clear()
    setUsuario(null)
  }, [])

  useEffect(() => {
    setOnUnauthorized(logout)
  }, [logout])

  useEffect(() => {
    if (!cargando) return
    api<UsuarioSesion>('/auth/me')
      .then(setUsuario)
      .catch(() => tokenStorage.clear())
      .finally(() => setCargando(false))
  }, [cargando])

  const login = useCallback(async (u: string, clave: string) => {
    const res = await api<LoginResultado>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario: u, clave }),
    })
    if (res.requiereCambio) return 'cambio-clave'
    tokenStorage.set(res.accessToken)
    setUsuario(res.usuario)
    return 'ok'
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>{children}</AuthContext.Provider>
  )
}
