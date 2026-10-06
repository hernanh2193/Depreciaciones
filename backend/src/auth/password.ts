import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Las contraseñas de DEP_USUARIOS están en texto plano y el sistema Java comparte la tabla.
 * Toda la verificación/almacenamiento pasa por estas dos funciones para poder migrar a
 * bcrypt en un solo lugar cuando se retire el sistema Java.
 */
export function verificarPassword(ingresada: string, almacenada: string | null): boolean {
  if (!almacenada) return false;
  // Comparar hashes de igual longitud evita filtrar información por tiempo de respuesta.
  const a = createHash('sha256').update(ingresada).digest();
  const b = createHash('sha256').update(almacenada).digest();
  return timingSafeEqual(a, b);
}

export function prepararPasswordParaGuardar(password: string): string {
  return password;
}
