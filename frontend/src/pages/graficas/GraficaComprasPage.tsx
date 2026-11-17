import { useCallback, useState } from 'react'
import { entero, graficasApi, quetzales, quetzalesCorto } from '../../api/graficas'
import { GraficoBarras } from '../../components/GraficoBarras'
import { useDatos } from '../../hooks/useDatos'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/**
 * Compras de activos por año (GrafEstaActivoMes.zul): activos registrados por mes según su fecha de inicio.
 * Java sumaba la depreciación mensual en lugar del valor de compra y omitía los meses sin compras.
 */
export function GraficaComprasPage() {
  const opciones = useDatos(graficasApi.opciones)
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [cuenta, setCuenta] = useState('')
  const [verTabla, setVerTabla] = useState(false)
  const cargar = useCallback(() => graficasApi.compras(anio, cuenta), [anio, cuenta])
  const { datos, error, cargando } = useDatos(cargar)

  const meses = datos ?? []
  const totalActivos = meses.reduce((s, m) => s + m.cantidad, 0)
  const totalValor = meses.reduce((s, m) => s + m.valor, 0)
  const barras = (campo: 'valor' | 'cantidad') =>
    meses.map((m) => ({ clave: m.mes, etiqueta: MESES[m.mes - 1], nombre: `${MESES_LARGOS[m.mes - 1]} ${anio}`, valor: m[campo] }))
  const nombreCuenta = opciones.datos?.cuentas.find((c) => String(c.valor) === cuenta)?.etiqueta

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <h1>Compras de activos por año</h1>
        <p className="nota">Activos registrados en cada mes según su fecha de inicio (excluye anulados).</p>
      </header>

      <div className="panel form-linea">
        <label>
          Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {(opciones.datos?.anios.length ? opciones.datos.anios : [anio]).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="crece">
          Cuenta
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
            <option value="">Todas las cuentas</option>
            {opciones.datos?.cuentas.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-link" onClick={() => setVerTabla((v) => !v)}>
          {verTabla ? 'Ocultar tabla' : 'Ver tabla'}
        </button>
      </div>

      {error && <p className="msg-error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {datos && (
        <>
          <p className="nota">
            En {anio}
            {nombreCuenta ? ` (cuenta ${nombreCuenta})` : ''}: <strong>{entero(totalActivos)} activos</strong> por{' '}
            <strong>{quetzales(totalValor)}</strong>.
          </p>
          <div className="graficos">
            <GraficoBarras
              titulo="Valor de compras por mes"
              datos={barras('valor')}
              orientacion="vertical"
              formato={quetzales}
              formatoEje={quetzalesCorto}
              etiquetas="maximo"
            />
            <GraficoBarras
              titulo="Activos comprados por mes"
              datos={barras('cantidad')}
              orientacion="vertical"
              formato={(n) => `${entero(n)} activos`}
              formatoEje={entero}
              etiquetas="maximo"
            />
          </div>
        </>
      )}

      {datos && verTabla && (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="al-der">Activos</th>
                <th className="al-der">Valor de compra</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes}>
                  <td>{MESES_LARGOS[m.mes - 1]}</td>
                  <td className="al-der">{entero(m.cantidad)}</td>
                  <td className="al-der">{quetzales(m.valor)}</td>
                </tr>
              ))}
              <tr className="fila-total">
                <td>Total {anio}</td>
                <td className="al-der">{entero(totalActivos)}</td>
                <td className="al-der">{quetzales(totalValor)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
