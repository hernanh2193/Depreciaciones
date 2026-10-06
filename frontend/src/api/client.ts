const TOKEN_KEY = 'dep_token'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const tokenStorage = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
}

/** Se llama cuando la API responde 401 (sesión expirada). Lo registra AuthProvider. */
let onUnauthorized: () => void = () => {}
export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get()
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 204) return undefined as T

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    // NestJS devuelve { message: string | string[] }
    const msg = body?.message
    const message = Array.isArray(msg) ? msg.join('\n') : msg || 'Solicitud no pudo ser procesada'
    if (res.status === 401 && token) onUnauthorized()
    throw new ApiError(res.status, message)
  }
  return body as T
}
