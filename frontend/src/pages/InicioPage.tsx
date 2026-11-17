import { useAuth } from '../auth/useAuth'

export function InicioPage() {
  const { usuario } = useAuth()
  return (
    <section className="panel">
      <h1>Bienvenido, {usuario?.nombre}</h1>
      <p>Seleccione una opción del menú para comenzar.</p>
    </section>
  )
}
