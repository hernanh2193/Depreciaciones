import { useLocation } from 'react-router'
import { buscarOpcion } from '../menu'

export function PendientePage() {
  const { pathname } = useLocation()
  const opcion = buscarOpcion(pathname)
  return (
    <section className="panel">
      <h1>{opcion?.titulo ?? 'Página no encontrada'}</h1>
      <p>
        {opcion
          ? 'Esta opción aún no ha sido migrada. Utilice el sistema anterior mientras tanto.'
          : 'La dirección solicitada no existe.'}
      </p>
    </section>
  )
}
