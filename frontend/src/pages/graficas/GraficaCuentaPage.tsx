import { useCallback, useState } from 'react'
import { entero, graficasApi, quetzales, quetzalesCorto } from '../../api/graficas'
import { GraficoBarras } from '../../components/GraficoBarras'
import { useDatos } from '../../hooks/useDatos'

/**
 * Gráfica por cuenta (GrafCuenta.zul). Java dibujaba cantidad y valor en el MISMO eje: las barras de cantidad
 * (cientos) quedaban invisibles junto a valores de cientos de millones. Aquí son dos gráficas, cada una con su escala.
 */
export function GraficaCuentaPage() {
  const [anulados, setAnulados] = useState(false)
  const [verTabla, setVerTabla] = useState(false)
  const cargar = useCallback(() => graficasApi.porCuenta(anulados), [anulados])
  const { datos, error, cargando } = useDatos(cargar)

  const filas = datos ?? []
  const barras = (campo: 'valor' | 'cantidad') =>
    filas.map((c) => ({ clave: c.cuenta, etiqueta: String(c.cuenta), nombre: `${c.cuenta} - ${c.descripcion}`, valor: c[campo] }))

  return (
    <section className="pagina">
      <header className="pagina-encabezado">
        <h1>Gráfica por cuenta</h1>
        <p className="nota">Cantidad de activos y valor de compra de cada cuenta principal.</p>
      </header>

      <div className="panel form-linea">
        <label className="check">
          <input type="checkbox" checked={anulados} onChange={(e) => setAnulados(e.target.checked)} />
          Incluir activos anulados
        </label>
        <span className="crece" />
        <button type="button" className="btn-link" onClick={() => setVerTabla((v) => !v)}>
          {verTabla ? 'Ocultar tabla' : 'Ver tabla'}
        </button>
      </div>

      {error && <p className="msg-error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {datos && (
        <div className="graficos">
          <GraficoBarras
            titulo="Valor de compra por cuenta"
            datos={barras('valor')}
            orientacion="horizontal"
            formato={quetzales}
            formatoEje={quetzalesCorto}
          />
          <GraficoBarras
            titulo="Cantidad de activos por cuenta"
            datos={barras('cantidad')}
            orientacion="horizontal"
            formato={(n) => `${entero(n)} activos`}
            formatoEje={entero}
          />
        </div>
      )}

      {datos && verTabla && (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th className="al-der">Activos</th>
                <th className="al-der">Valor de compra</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => (
                <tr key={c.cuenta}>
                  <td>
                    {c.cuenta} - {c.descripcion}
                  </td>
                  <td className="al-der">{entero(c.cantidad)}</td>
                  <td className="al-der">{quetzales(c.valor)}</td>
                </tr>
              ))}
              <tr className="fila-total">
                <td>Total</td>
                <td className="al-der">{entero(filas.reduce((s, c) => s + c.cantidad, 0))}</td>
                <td className="al-der">{quetzales(filas.reduce((s, c) => s + c.valor, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
