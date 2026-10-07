import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database/database.service.js';

@Injectable()
export class AppService {
  constructor(private readonly db: DatabaseService) {}

  /** Verifica que la API esté arriba y que la conexión a Oracle responda. */
  async salud() {
    try {
      await this.db.query('SELECT 1 FROM dual');
      return { estado: 'ok', baseDatos: 'ok' };
    } catch (err) {
      return { estado: 'ok', baseDatos: 'error', detalle: (err as Error).message };
    }
  }
}
