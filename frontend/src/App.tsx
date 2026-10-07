import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import { MainLayout } from './layout/MainLayout'
import { ActivoDetallePage } from './pages/activos/ActivoDetallePage'
import { BuscarActivosPage } from './pages/activos/BuscarActivosPage'
import { RegistroActivoPage } from './pages/activos/RegistroActivoPage'
import { CatalogoPorcentajePage } from './pages/catalogos/CatalogoPorcentajePage'
import { CONFIG_CUENTAS, CONFIG_DIVISIONES, CONFIG_SUBCUENTAS } from './pages/catalogos/catalogosConfig'
import { PeriodosPage } from './pages/catalogos/PeriodosPage'
import { RelacionesPage } from './pages/catalogos/RelacionesPage'
import { InicioPage } from './pages/InicioPage'
import { LoginPage } from './pages/LoginPage'
import { PendientePage } from './pages/PendientePage'
import './App.css'

function RequiereSesion({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <div className="cargando">Cargando…</div>
  if (!usuario) return <Navigate to="/login" replace />
  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequiereSesion>
                <MainLayout />
              </RequiereSesion>
            }
          >
            <Route index element={<InicioPage />} />
            {/* key: fuerza a reiniciar el estado al cambiar entre catálogos que usan el mismo componente */}
            <Route path="catalogos/cuentas" element={<CatalogoPorcentajePage key="cuentas" config={CONFIG_CUENTAS} />} />
            <Route
              path="catalogos/subcuentas"
              element={<CatalogoPorcentajePage key="subcuentas" config={CONFIG_SUBCUENTAS} />}
            />
            <Route
              path="catalogos/division-cuentas"
              element={<CatalogoPorcentajePage key="divisiones" config={CONFIG_DIVISIONES} />}
            />
            <Route path="catalogos/relacion-cuentas" element={<RelacionesPage />} />
            <Route path="catalogos/periodos" element={<PeriodosPage />} />
            <Route path="activos/registro" element={<RegistroActivoPage />} />
            <Route
              path="activos/modificacion"
              element={
                <BuscarActivosPage
                  key="modificacion"
                  titulo="Modificación de activos"
                  descripcion="Busque un activo para ver su ficha, modificar sus datos o regenerar su depreciación."
                />
              }
            />
            <Route
              path="activos/otros-porcentajes"
              element={
                <BuscarActivosPage
                  key="otros"
                  titulo="Otros porcentajes de activos"
                  descripcion="Busque un activo para registrar un tramo con otro porcentaje y regenerar su depreciación."
                  pestana="otro"
                />
              }
            />
            <Route path="activos/:id" element={<ActivoDetallePage />} />
            {/* Las opciones aún no migradas caen aquí */}
            <Route path="*" element={<PendientePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
