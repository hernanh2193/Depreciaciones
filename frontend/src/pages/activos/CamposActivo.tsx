import type { FormActivo } from './formActivo'

interface Props {
  form: FormActivo
  onChange: (f: FormActivo) => void
}

/** Campos comunes de registro y modificación de activos. */
export function CamposActivo({ form, onChange }: Props) {
  const campo = (k: keyof FormActivo) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => onChange({ ...form, [k]: e.target.value }),
  })

  return (
    <>
      <label className="col-completa">
        Descripción
        <textarea rows={3} maxLength={4000} required {...campo('descripcion')} />
      </label>
      <label>
        Fecha de inicio
        <input type="date" required {...campo('fechaInicio')} />
      </label>
      <label>
        Valor original (Q)
        <input type="number" inputMode="decimal" min={1.01} step={0.01} required {...campo('valorOriginal')} />
      </label>
      <label>
        No. de tarjeta
        <input maxLength={50} {...campo('tarjeta')} />
      </label>
      <label>
        Cuenta presupuestaria
        <input type="number" inputMode="numeric" min={0} step={1} {...campo('cuentaPresupuesto')} />
      </label>
      <label>
        No. de constancia
        <input maxLength={500} {...campo('noConstancia')} />
      </label>
      <label>
        Fecha de constancia
        <input type="date" {...campo('fechaConstancia')} />
      </label>
      <label>
        No. de CUR
        <input maxLength={500} {...campo('noCur')} />
      </label>
      <label>
        Marca
        <input maxLength={100} {...campo('marca')} />
      </label>
      <label>
        Modelo
        <input maxLength={4000} {...campo('modelo')} />
      </label>
      <label>
        Serie
        <input maxLength={4000} {...campo('serie')} />
      </label>
      <label>
        Año
        <input type="number" inputMode="numeric" min={1900} max={2100} step={1} {...campo('anio')} />
      </label>
    </>
  )
}
