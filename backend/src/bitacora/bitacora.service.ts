import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Envía eventos al servicio de auditoría institucional (equivalente a Bitacora.java).
 * Es opcional: si BITACORA_URL no está definido no se envía nada.
 * Nunca bloquea ni hace fallar la operación principal.
 */
@Injectable()
export class BitacoraService {
  private readonly logger = new Logger(BitacoraService.name);

  constructor(private readonly config: ConfigService) {}

  registrar(usuario: string, modulo: string, observacion: string): void {
    const url = this.config.get<string>('BITACORA_URL');
    if (!url) return;

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        USUARIO: usuario,
        SISTEMA: 'DEPRECIACIONES',
        MODULO: modulo,
        CONTENEDOR: 'null',
        ANO_ARRIBO: 0,
        NUM_ARRIBO: 0,
        OBSERVACION: observacion,
      }),
      signal: AbortSignal.timeout(3000),
    })
      .then((res) => {
        if (!res.ok) this.logger.warn(`Bitácora respondió HTTP ${res.status}`);
      })
      .catch((err: Error) => this.logger.warn(`Bitácora no disponible: ${err.message}`));
  }
}
