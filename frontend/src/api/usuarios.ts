import type { Rol } from '../auth/types'
import { api } from './client'

export interface Usuario {
  codigo: number
  usuario: string
  nombres: string
  apellidos: string
  rol: Rol
  estado: 'A' | 'I'
  correo: string | null
  observacion: string | null
  usuarioCrea: string | null
  fechaCrea: string | null
}

export interface EmpleadoRrhh {
  codigo: number
  nombres: string
  apellidos: string
  usuario: string | null
  correo: string | null
  yaRegistrado: boolean
}

export interface DatosUsuario {
  rol: Rol
  estado: 'A' | 'I'
  correo: string
  observacion: string
}

const json = (method: string, body?: unknown) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })

export const usuariosApi = {
  listar: () => api<Usuario[]>('/usuarios'),
  obtener: (codigo: number) => api<Usuario>(`/usuarios/${codigo}`),
  empleado: (codigo: number) => api<EmpleadoRrhh>(`/usuarios/empleado/${codigo}`),
  crear: (codigo: number, d: DatosUsuario) => api<{ usuario: string }>('/usuarios', json('POST', { codigo, ...d })),
  actualizar: (codigo: number, d: DatosUsuario) => api<void>(`/usuarios/${codigo}`, json('PUT', d)),
  restablecerClave: (codigo: number) => api<{ usuario: string }>(`/usuarios/${codigo}/restablecer-clave`, json('POST')),
}
