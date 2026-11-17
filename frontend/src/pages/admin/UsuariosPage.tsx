import { Link, useLocation } from 'react-router'
import { usuariosApi, type Usuario } from '../../api/usuarios'
import { NOMBRE_ROL } from '../../auth/types'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useDatos } from '../../hooks/useDatos'
import { fecha } from '../../utils/formato'

const COLUMNAS: Columna<Usuario>[] = [
  { titulo: 'Código', celda: (u) => u.codigo, alinear: 'der' },
  { titulo: 'Usuario', celda: (u) => u.usuario },
  { titulo: 'Nombre', celda: (u) => `${u.nombres} ${u.apellidos}` },
  { titulo: 'Rol', celda: (u) => NOMBRE_ROL[u.rol] ?? u.rol },
  {
    titulo: 'Estado',
    celda: (u) => <span className={`badge ${u.estado === 'A' ? 'estado-A' : 'estado-I'}`}>{u.estado === 'A' ? 'ACTIVO' : 'INACTIVO'}</span>,
  },
  { titulo: 'Correo', celda: (u) => u.correo },
  { titulo: 'Creado', celda: (u) => (u.fechaCrea ? `${fecha(u.fechaCrea)}${u.usuarioCrea ? ` · ${u.usuarioCrea}` : ''}` : '') },
  {
    titulo: 'Acciones',
    celda: (u) => (
      <Link className="btn-secundario btn-chico" to={`/admin/usuarios/${u.codigo}`}>
        Editar
      </Link>
    ),
  },
]

/** Administración de usuarios: listado con "Crear usuario" y la acción "Editar" por fila. */
export function UsuariosPage() {
  const { datos, error, cargando } = useDatos(usuariosApi.listar)
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso

  return (
    <section className="pagina">
      <header className="pagina-encabezado form-linea" style={{ padding: 0 }}>
        <div className="crece">
          <h1>Usuarios</h1>
          <p className="nota">Usuarios con acceso al sistema de depreciaciones y su rol.</p>
        </div>
        <Link className="btn-primario" to="/admin/usuarios/nuevo">
          Crear usuario
        </Link>
      </header>

      {aviso && <p className="msg-ok">{aviso}</p>}

      <TablaDatos
        columnas={COLUMNAS}
        filas={datos}
        clave={(u) => u.codigo}
        cargando={cargando}
        error={error}
        textoBusqueda={(u) => `${u.codigo} ${u.usuario} ${u.nombres} ${u.apellidos} ${u.correo ?? ''} ${NOMBRE_ROL[u.rol] ?? ''}`}
        vacio="No hay usuarios"
      />
    </section>
  )
}
