import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import logo from '../assets/epq.png'
import { useAuth } from '../auth/useAuth'
import { NOMBRE_ROL } from '../auth/types'
import { menuParaRol } from '../menu'

export function MainLayout() {
  const { usuario, logout } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  if (!usuario) return null

  return (
    <div className="app">
      <header className="barra">
        <button className="btn-menu" onClick={() => setMenuAbierto((v) => !v)} aria-label="Menú">
          ☰
        </button>
        <img src={logo} alt="" width={36} height={36} />
        <span className="barra-titulo">Depreciaciones</span>
        <span className="barra-usuario">
          {usuario.nombre} <small>({NOMBRE_ROL[usuario.rol] ?? usuario.rol})</small>
        </span>
        <button className="btn-salir" onClick={logout}>
          Salir
        </button>
      </header>

      <div className="cuerpo">
        <nav className={`menu ${menuAbierto ? 'abierto' : ''}`} onClick={() => setMenuAbierto(false)}>
          <NavLink to="/" end>
            Inicio
          </NavLink>
          {menuParaRol(usuario.rol).map((grupo) => (
            <div key={grupo.titulo} className="menu-grupo">
              <div className="menu-grupo-titulo">{grupo.titulo}</div>
              {grupo.opciones.map((op) => (
                <NavLink key={op.ruta} to={op.ruta} className={op.migrado ? '' : 'pendiente'}>
                  {op.titulo}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
