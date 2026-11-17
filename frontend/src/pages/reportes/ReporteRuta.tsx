import { useParams } from 'react-router'
import { REPORTES } from '../../api/reportes'
import { PendientePage } from '../PendientePage'
import { ReportePage } from './ReportePage'

/** /reportes/:clave → pantalla del reporte (key: reinicia el estado al cambiar de reporte). */
export function ReporteRuta() {
  const clave = useParams().clave ?? ''
  const reporte = REPORTES[clave]
  return reporte ? <ReportePage key={clave} reporte={reporte} /> : <PendientePage />
}
