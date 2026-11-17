import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ActivosRepository } from './../src/activos/activos.repository.js';
import { JwtAuthGuard, RolesGuard } from './../src/auth/guards.js';
import { Rol } from './../src/auth/roles.js';
import { ConsultasController } from './../src/consultas/consultas.controller.js';
import { ConsultasRepository } from './../src/consultas/consultas.repository.js';

// Capa HTTP de /consultas con guards reales y repositorios simulados (sin Oracle).
describe('ConsultasController (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const consultas = {
    activos: vi.fn().mockResolvedValue([]),
    totales: vi.fn().mockResolvedValue({ activos: 0 }),
    opciones: vi.fn().mockResolvedValue({ cuentas: [], relaciones: [] }),
  };
  const activos = { obtener: vi.fn(), detalle: vi.fn().mockResolvedValue([]) };
  const token = (rol: Rol) => jwt.sign({ sub: 'prueba', nombre: 'Prueba', rol });

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba' })],
      controllers: [ConsultasController],
      providers: [
        { provide: ConsultasRepository, useValue: consultas },
        { provide: ActivosRepository, useValue: activos },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    jwt = mod.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([Rol.ADMINISTRADOR, Rol.OPERADOR, Rol.CONSULTAS, Rol.AUDITORIA])('el rol %s puede consultar', async (rol) => {
    await request(app.getHttpServer()).get('/consultas/activos').set('Authorization', `Bearer ${token(rol)}`).expect(200);
  });

  it('filtros vacíos se convierten en null (no en 0)', async () => {
    await request(app.getHttpServer())
      .get('/consultas/activos?texto=&estado=&cuenta=&relacion=')
      .set('Authorization', `Bearer ${token(Rol.AUDITORIA)}`)
      .expect(200);
    expect(consultas.activos).toHaveBeenCalledWith(
      expect.objectContaining({ texto: null, estado: null, cuenta: null, relacion: null, limite: 500 }),
    );
  });

  it('filtros con valor llegan como número', async () => {
    await request(app.getHttpServer())
      .get('/consultas/activos?cuenta=1232&relacion=30&limite=50&texto=%20compresor%20')
      .set('Authorization', `Bearer ${token(Rol.CONSULTAS)}`)
      .expect(200);
    expect(consultas.activos).toHaveBeenCalledWith(
      expect.objectContaining({ texto: 'compresor', cuenta: 1232, relacion: 30, limite: 50 }),
    );
  });

  it('cuenta no numérica responde 400', () => {
    return request(app.getHttpServer())
      .get('/consultas/activos?cuenta=abc')
      .set('Authorization', `Bearer ${token(Rol.CONSULTAS)}`)
      .expect(400);
  });

  it('activo inexistente responde 404', () => {
    activos.obtener.mockResolvedValue(null);
    return request(app.getHttpServer())
      .get('/consultas/activos/999999/depreciacion')
      .set('Authorization', `Bearer ${token(Rol.AUDITORIA)}`)
      .expect(404);
  });

  it('sin token responde 401', () => {
    return request(app.getHttpServer()).get('/consultas/opciones').expect(401);
  });
});
