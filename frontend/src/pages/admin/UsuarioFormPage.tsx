import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { usuariosApi, type DatosUsuario, type EmpleadoRrhh } from '../../api/usuarios'
import { NOMBRE_ROL, Rol } from '../../auth/types'
import { useAuth } from '../../auth/useAuth'
import { useDatos } from '../../hooks/useDatos'
import { fecha } from '../../utils/formato'

const textoError = (err: unknown) => (err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
const ROLES = [Rol.ADMINISTRADOR, Rol.OPERADOR, Rol.CONSULTAS, Rol.AUDITORIA]

/** /admin/usuarios/nuevo (crear) y /admin/usuarios/:codigo (editar). */
export function UsuarioFormPage() {
  const param = useParams().codigo
  return param === 'nuevo' || param === undefined ? <CrearUsuario /> : <EditarUsuario codigo={Number(param)} />
}

// ---------------- Crear ----------------

function CrearUsuario() {
  const navigate = useNavigate()
  const [codigo, setCodigo] = useState('')
  const [empleado, setEmpleado] = useState<EmpleadoRrhh | null>(null)
  const [datos, setDatos] = useState<DatosUsuario>({ rol: Rol.CONSULTAS, estado: 'A', correo: '', observacion: '' })
  const [buscando, setBuscando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function buscar(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    setEmpleado(null)
    if (!codigo) return
    setBuscando(true)
    try {
      const emp = await usuariosApi.empleado(Number(codigo))
      setEmpleado(emp)
      setDatos((d) => ({ ...d, correo: emp.correo ?? '' }))
    } catch (err) {
      setError(textoError(err))
    } finally {
      setBuscando(false)
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!empleado) return
    setError('')
    setEnviando(true)
    try {
      const r = await usuariosApi.crear(empleado.codigo, datos)
      navigate('/admin/usuarios', {
        state: { aviso: `Usuario ${r.usuario} creado. Debe ingresar con la clave inicial del sistema y cambiarla en su primer ingreso.` },
      })
    } catch (err) {
      setError(textoError(err))
      setEnviando(false)
    }
  }

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <p className="nota">
          <Link to="/admin/usuarios">← Usuarios</Link>
        </p>
        <h1>Crear usuario</h1>
        <p className="nota">
          Ingrese el código de empleado: el nombre, el usuario y el correo se toman de Recursos Humanos.
        </p>
      </header>

      <form className="panel form-linea" onSubmit={buscar}>
        <label>
          Código de empleado
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={99999}
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value)
              setEmpleado(null)
            }}
            required
            autoFocus
          />
        </label>
        <button type="submit" className="btn-secundario" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar en RRHH'}
        </button>
      </form>

      {error && <p className="msg-error">{error}</p>}

      {empleado && (
        <form className="panel form-grid" onSubmit={guardar}>
          <DatosEmpleado codigo={empleado.codigo} usuario={empleado.usuario} nombres={empleado.nombres} apellidos={empleado.apellidos} />
          {empleado.yaRegistrado ? (
            <p className="aviso col-completa">
              Este empleado ya tiene usuario en el sistema.{' '}
              <Link to={`/admin/usuarios/${empleado.codigo}`}>Editarlo</Link>
            </p>
          ) : !empleado.usuario ? (
            <p className="msg-error col-completa">El empleado no tiene nombre de usuario en Recursos Humanos.</p>
          ) : (
            <>
              <CamposUsuario datos={datos} onChange={setDatos} />
              <p className="nota col-completa">
                La clave no se escribe aquí: el usuario ingresará con la <strong>clave inicial</strong> del sistema y deberá
                cambiarla en su primer ingreso.
              </p>
              <div className="col-completa acciones">
                <button type="submit" className="btn-primario" disabled={enviando}>
                  {enviando ? 'Guardando…' : 'Crear usuario'}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </section>
  )
}

// ---------------- Editar ----------------

function EditarUsuario({ codigo }: { codigo: number }) {
  const cargar = useCallback(() => usuariosApi.obtener(codigo), [codigo])
  const { datos: usuario, error, cargando } = useDatos(cargar)
  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <p className="nota">
          <Link to="/admin/usuarios">← Usuarios</Link>
        </p>
        <h1>Editar usuario</h1>
      </header>
      {cargando && <p className="cargando">Cargando…</p>}
      {error && <p className="msg-error">{error}</p>}
      {usuario && (
        <FormEditar
          key={usuario.codigo}
          codigo={usuario.codigo}
          usuario={usuario.usuario}
          nombres={usuario.nombres}
          apellidos={usuario.apellidos}
          creado={usuario.fechaCrea ? `${fecha(usuario.fechaCrea)}${usuario.usuarioCrea ? ` por ${usuario.usuarioCrea}` : ''}` : null}
          inicial={{ rol: usuario.rol, estado: usuario.estado, correo: usuario.correo ?? '', observacion: usuario.observacion ?? '' }}
        />
      )}
    </section>
  )
}

function FormEditar({
  codigo,
  usuario,
  nombres,
  apellidos,
  creado,
  inicial,
}: {
  codigo: number
  usuario: string
  nombres: string
  apellidos: string
  creado: string | null
  inicial: DatosUsuario
}) {
  const navigate = useNavigate()
  const { usuario: sesion } = useAuth()
  const esUstedMismo = sesion?.usuario.toUpperCase() === usuario.toUpperCase()
  const [datos, setDatos] = useState<DatosUsuario>(inicial)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    setEnviando(true)
    try {
      await usuariosApi.actualizar(codigo, datos)
      navigate('/admin/usuarios', { state: { aviso: `Usuario ${usuario} actualizado.` } })
    } catch (err) {
      setMsg({ tipo: 'error', texto: textoError(err) })
      setEnviando(false)
    }
  }

  async function restablecer() {
    const ok = window.confirm(
      `La clave de ${usuario} quedará como la clave inicial del sistema y deberá cambiarla en su próximo ingreso.\n\n¿Continuar?`,
    )
    if (!ok) return
    setMsg(null)
    try {
      await usuariosApi.restablecerClave(codigo)
      setMsg({ tipo: 'ok', texto: `Clave de ${usuario} restablecida. Comuníquele la clave inicial; deberá cambiarla al ingresar.` })
    } catch (err) {
      setMsg({ tipo: 'error', texto: textoError(err) })
    }
  }

  return (
    <form className="panel form-grid" onSubmit={guardar}>
      <DatosEmpleado codigo={codigo} usuario={usuario} nombres={nombres} apellidos={apellidos} />
      <CamposUsuario datos={datos} onChange={setDatos} bloquearRolYEstado={esUstedMismo} />
      {esUstedMismo && (
        <p className="nota col-completa">Es su propio usuario: no puede cambiar su rol ni desactivarse.</p>
      )}
      {creado && <p className="nota col-completa">Creado el {creado}.</p>}
      {msg && <p className={`col-completa ${msg.tipo === 'ok' ? 'msg-ok' : 'msg-error'}`}>{msg.texto}</p>}
      <div className="col-completa acciones">
        <button type="button" className="btn-secundario" onClick={restablecer}>
          Restablecer clave
        </button>
        <button type="submit" className="btn-primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

// ---------------- Comunes ----------------

function DatosEmpleado({ codigo, usuario, nombres, apellidos }: { codigo: number; usuario: string | null; nombres: string; apellidos: string }) {
  return (
    <dl className="col-completa datos-activo" style={{ padding: 0 }}>
      <div>
        <dt>Código de empleado</dt>
        <dd>{codigo}</dd>
      </div>
      <div>
        <dt>Usuario</dt>
        <dd>{usuario ?? '—'}</dd>
      </div>
      <div>
        <dt>Nombre</dt>
        <dd>
          {nombres} {apellidos}
        </dd>
      </div>
    </dl>
  )
}

function CamposUsuario({
  datos,
  onChange,
  bloquearRolYEstado = false,
}: {
  datos: DatosUsuario
  onChange: (d: DatosUsuario) => void
  bloquearRolYEstado?: boolean
}) {
  return (
    <>
      <label>
        Rol
        <select value={datos.rol} onChange={(e) => onChange({ ...datos, rol: e.target.value as Rol })} disabled={bloquearRolYEstado}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {NOMBRE_ROL[r]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Estado
        <select
          value={datos.estado}
          onChange={(e) => onChange({ ...datos, estado: e.target.value as 'A' | 'I' })}
          disabled={bloquearRolYEstado}
        >
          <option value="A">ACTIVO</option>
          <option value="I">INACTIVO</option>
        </select>
      </label>
      <label>
        Correo
        <input type="email" maxLength={40} value={datos.correo} onChange={(e) => onChange({ ...datos, correo: e.target.value })} />
      </label>
      <label className="col-completa">
        Observación
        <textarea rows={2} maxLength={100} value={datos.observacion} onChange={(e) => onChange({ ...datos, observacion: e.target.value })} />
      </label>
    </>
  )
}
