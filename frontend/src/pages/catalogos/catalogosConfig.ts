import { catalogosApi, type Cuenta, type Division, type SubCuenta } from '../../api/catalogos'
import type { ConfigCatalogo } from './CatalogoPorcentajePage'

export const CONFIG_CUENTAS: ConfigCatalogo<Cuenta> = {
  titulo: 'Cuenta principal',
  descripcion: 'Cuentas contables de activos fijos y su porcentaje de depreciación anual.',
  nombre: 'la cuenta',
  listar: catalogosApi.cuentas,
  crear: catalogosApi.crearCuenta,
  maxCodigo: 9_999_999_999,
  maxDescripcion: 100,
  decimales: 0,
  conCorrelativo: false,
}

export const CONFIG_SUBCUENTAS: ConfigCatalogo<SubCuenta> = {
  titulo: 'Sub cuenta',
  descripcion: 'Subcuentas que se asocian a una cuenta principal en "Unificar cuenta".',
  nombre: 'la subcuenta',
  listar: catalogosApi.subCuentas,
  crear: catalogosApi.crearSubCuenta,
  maxCodigo: 99_999,
  maxDescripcion: 300,
  decimales: 0,
  conCorrelativo: true,
}

export const CONFIG_DIVISIONES: ConfigCatalogo<Division> = {
  titulo: 'División cuenta',
  descripcion: 'Divisiones opcionales de una subcuenta. El porcentaje admite hasta 2 decimales.',
  nombre: 'la división',
  listar: catalogosApi.divisiones,
  crear: catalogosApi.crearDivision,
  maxCodigo: 99_999,
  maxDescripcion: 300,
  decimales: 2,
  conCorrelativo: true,
}
