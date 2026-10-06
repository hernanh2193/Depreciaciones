import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import { MainLayout } from './layout/MainLayout'
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
            {/* Las opciones aún no migradas caen aquí */}
            <Route path="*" element={<PendientePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
