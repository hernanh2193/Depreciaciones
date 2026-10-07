import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import type { DatabaseService } from './database/database.service.js';

describe('AppController', () => {
  it('reporta la base de datos ok cuando Oracle responde', async () => {
    const db = { query: vi.fn().mockResolvedValue([{ 1: 1 }]) } as unknown as DatabaseService;
    const controller = new AppController(new AppService(db));

    await expect(controller.salud()).resolves.toEqual({ estado: 'ok', baseDatos: 'ok' });
  });

  it('reporta error de base de datos sin tumbar la API', async () => {
    const db = { query: vi.fn().mockRejectedValue(new Error('ORA-12541')) } as unknown as DatabaseService;
    const controller = new AppController(new AppService(db));

    await expect(controller.salud()).resolves.toMatchObject({ baseDatos: 'error', detalle: 'ORA-12541' });
  });
});
