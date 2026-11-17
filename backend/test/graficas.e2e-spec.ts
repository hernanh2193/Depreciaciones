import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { JwtAuthGuard, RolesGuard } from './../src/auth/guards.js';
import { Rol } from './../src/auth/roles.js';
import { GraficasController } from './../src/graficas/graficas.controller.js';
import { GraficasRepository } from './../src/graficas/graficas.repository.js';

// Capa HTTP de /graficas con guards reales y repositorio simulado (sin Oracle).
describe('GraficasController (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const repo = {
    porCuenta: vi.fn().mockResolvedValue([]),
    comprasPorMes: vi.fn().mockResolvedValue([]),
    anios: vi.fn().mockResolvedValue([]),
    cuentas: vi.fn().mockResolvedValue([]),
  };
  const token = (rol: Rol) => jwt.sign({ sub: 'prueba', nombre: 'Prueba', rol });

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba' })],
      controllers: [GraficasController],
      providers: [{ provide: GraficasRepository, useValue: repo }, JwtAuthGuard, RolesGuard],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    jwt = mod.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('Auditoría no tiene acceso (como en Java)', () => {
    return request(app.getHttpServer()).get('/graficas/cuentas').set('Authorization', `Bearer ${token(Rol.AUDITORIA)}`).expect(403);
  });

  it('por cuenta excluye anulados por defecto', async () => {
    await request(app.getHttpServer()).get('/graficas/cuentas').set('Authorization', `Bearer ${token(Rol.CONSULTAS)}`).expect(200);
    expect(repo.porCuenta).toHaveBeenCalledWith(false);
  });

  it('por cuenta con anulados=true', async () => {
    await request(app.getHttpServer())
      .get('/graficas/cuentas?anulados=true')
      .set('Authorization', `Bearer ${token(Rol.CONSULTAS)}`)
      .expect(200);
    expect(repo.porCuenta).toHaveBeenCalledWith(true);
  });

  it('compras: año obligatorio y cuenta opcional', async () => {
    await request(app.getHttpServer()).get('/graficas/compras').set('Authorization', `Bearer ${token(Rol.OPERADOR)}`).expect(400);
    await request(app.getHttpServer()).get('/graficas/compras?anio=2025&cuenta=').set('Authorization', `Bearer ${token(Rol.OPERADOR)}`).expect(200);
    expect(repo.comprasPorMes).toHaveBeenCalledWith(2025, null);
  });
});
