import { createContext, useContext } from 'react'
import type { UsuarioSesion } from './types'

export interface AuthState {
  usuario: UsuarioSesion | null
  cargando: boolean
  /** Devuelve 'cambio-clave' si el usuario entró con la clave inicial y debe cambiarla. */
  login: (usuario: string, clave: string) => Promise<'ok' | 'cambio-clave'>
  logout: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
