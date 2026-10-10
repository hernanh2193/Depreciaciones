import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'

/** Carga datos de la API al montar el componente y permite recargarlos. */
export function useDatos<T>(cargar: () => Promise<T>) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    cargar()
      .then((d) => {
        if (!vigente) return
        setDatos(d)
        setError('')
      })
      .catch((err) => {
        if (vigente) setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
      })
    return () => {
      vigente = false
    }
  }, [cargar, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return { datos, error, cargando: datos === null && !error, recargar }
}
