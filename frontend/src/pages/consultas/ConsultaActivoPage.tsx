import { useCallback, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { NOMBRE_ESTADO_ACTIVO, type DetalleDepreciacion } from '../../api/activos'
import { consultasApi } from '../../api/consultas'
import { puedeEditarCatalogos } from '../../auth/permisos'
import { useAuth } from '../../auth/useAuth'
import { TablaDatos, type Columna } from '../../components/TablaDatos'
import { useDatos } from '../../hooks/useDatos'
import { descargarCsv } from '../../utils/csv'
import { fecha, moneda, porcentaje } from '../../utils/formato'

const COLUMNAS: Columna<DetalleDepreciacion>[] = [
  { titulo: 'No.', celda: (d) => d.correlativo, alinear: 'der' },
  { titulo: 'Periodo', celda: (d) => d.periodo },
  { titulo: 'Mes', celda: (d) => d.descripcion },
  { titulo: 'Saldo inicial', celda: (d) => moneda(d.saldoInicial), alinear: 'der' },
  { titulo: 'Factor', celda: (d) => d.factor, alinear: 'der' },
  { titulo: 'Depreciación mes', celda: (d) => moneda(d.depreciacionMes), alinear: 'der' },
  { titulo: 'Acumulada', celda: (d) => moneda(d.depreciacionAcumulada), alinear: 'der' },
  { titulo: 'Valor en libros', celda: (d) => moneda(d.valorLibros), alinear: 'der' },
  { titulo: 'Observación', celda: (d) => d.observaciones },
]

const COLUMNAS_CSV: { titulo: string; valor: (d: DetalleDepreciacion) => unknown }[] = [
  { titulo: 'No.', valor: (d) => d.correlativo },
  { titulo: 'Periodo', valor: (d) => d.periodo },
  { titulo: 'Mes', valor: (d) => d.descripcion },
  { titulo: 'Saldo inicial', valor: (d) => d.saldoInicial },
  { titulo: 'Factor', valor: (d) => d.factor },
  { titulo: 'Depreciación mes', valor: (d) => d.depreciacionMes },
  { titulo: 'Depreciación acumulada', valor: (d) => d.depreciacionAcumulada },
  { titulo: 'Valor en libros', valor: (d) => d.valorLibros },
  { titulo: 'Observación', valor: (d) => d.observaciones },
]

/** Consulta de depreciaciones (ConsulDeprecia.zul): datos del activo y su detalle mes a mes, solo lectura. */
export function ConsultaActivoPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const cargarActivo = useCallback(() => consultasApi.activo(id), [id])
  const cargarDetalle = useCallback(() => consultasApi.depreciacion(id), [id])
  const activo = useDatos(cargarActivo)
  const detalle = useDatos(cargarDetalle)
  const a = activo.datos

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <p className="nota">
          <button type="button" className="btn-link" onClick={() => navigate(-1)}>
            ← Volver
          </button>
          {a && puedeEditarCatalogos(usuario?.rol) && (
            <>
              {' · '}
              <Link to={`/activos/${id}`}>Abrir en Modificación de activos</Link>
            </>
          )}
        </p>
        <h1>Activo {id}</h1>
        {a && <p className="nota texto-recortado-2">{a.descripcion}</p>}
      </header>

      {activo.cargando && <p className="cargando">Cargando…</p>}
      {activo.error && <p className="msg-error">{activo.error}</p>}

      {a && (
        <>
          <div className="tarjetas">
            <Dato titulo="Estado">
              <span className={`badge estado-${a.estado}`}>{NOMBRE_ESTADO_ACTIVO[a.estado] ?? a.estado}</span>
            </Dato>
            <Dato titulo="Valor original">{moneda(a.valorOriginal)}</Dato>
            <Dato titulo="Depreciación mensual">
              {moneda(a.valorMensual)}
              <small>
                {porcentaje(a.porcentaje)} anual · factor {a.factor}
              </small>
            </Dato>
            <Dato titulo="Depreciación acumulada">{moneda(a.depreciacionAcumulada)}</Dato>
            <Dato titulo="Valor en libros">{a.valorLibros === null ? '—' : moneda(a.valorLibros)}</Dato>
          </div>

          <dl className="panel datos-activo">
            <Campo t="Cuenta" v={a.cuenta} />
            <Campo t="Subcuenta" v={a.subCuenta} />
            <Campo t="División" v={a.division} />
            <Campo t="No. tarjeta" v={a.tarjeta} />
            <Campo t="Cuenta presupuestaria" v={a.cuentaPresupuesto} />
            <Campo t="Fecha de inicio" v={fecha(a.fechaInicio)} />
            <Campo t="Fecha final" v={fecha(a.fechaFinal)} />
            <Campo t="No. constancia" v={a.noConstancia} />
            <Campo t="Fecha de constancia" v={fecha(a.fechaConstancia)} />
            <Campo t="No. CUR" v={a.noCur} />
            <Campo t="Marca" v={a.marca} />
            <Campo t="Modelo" v={a.modelo} />
            <Campo t="Serie" v={a.serie} />
            <Campo t="Año" v={a.anio} />
            {a.trasladadoA && (
              <Campo
                t="Trasladado al activo"
                v={<Link to={`/consultas/activo/${a.trasladadoA}`}>No. {a.trasladadoA}</Link>}
              />
            )}
            <Campo t="Registrado por" v={`${a.usuarioCrea ?? ''} ${fecha(a.fechaCrea)}`} />
          </dl>

          <div className="form-linea" style={{ padding: 0 }}>
            <h2 className="crece" style={{ margin: 0 }}>
              Depreciación mes a mes ({a.mesesGenerados} meses)
            </h2>
            <button
              type="button"
              className="btn-secundario"
              disabled={!detalle.datos?.length}
              onClick={() => detalle.datos && descargarCsv(`depreciacion-activo-${id}`, COLUMNAS_CSV, detalle.datos)}
            >
              Descargar CSV
            </button>
          </div>
          <TablaDatos
            columnas={COLUMNAS}
            filas={detalle.datos}
            clave={(d) => d.correlativo}
            cargando={detalle.cargando}
            error={detalle.error}
            vacio="Este activo no tiene depreciación generada"
          />
        </>
      )}
    </section>
  )
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="tarjeta">
      <span className="tarjeta-titulo">{titulo}</span>
      <div className="tarjeta-valor">{children}</div>
    </div>
  )
}

function Campo({ t, v }: { t: string; v: ReactNode }) {
  return (
    <div>
      <dt>{t}</dt>
      <dd>{v === null || v === undefined || v === '' ? '—' : v}</dd>
    </div>
  )
}
