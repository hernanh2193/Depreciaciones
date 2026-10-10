import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { JwtAuthGuard, RolesGuard } from './../src/auth/guards.js';
import { Rol } from './../src/auth/roles.js';
import { CatalogosController } from './../src/catalogos/catalogos.controller.js';
import { CatalogosService } from './../src/catalogos/catalogos.service.js';

// Capa HTTP de /catalogos con los guards reales (JWT + roles) y el servicio simulado.
describe('CatalogosController (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const catalogos = {
    listarCuentas: vi.fn().mockResolvedValue([{ codigo: 1231, descripcion: 'X', porcentaje: 20 }]),
    crearCuenta: vi.fn().mockResolvedValue(undefined),
    crearDivision: vi.fn().mockResolvedValue(undefined),
    crearPeriodo: vi.fn().mockResolvedValue({ codigo: 202611 }),
    listarPeriodos: vi.fn().mockResolvedValue([]),
  };

  const token = (rol: Rol) => jwt.sign({ sub: 'prueba', nombre: 'Prueba', rol });

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba' })],
      controllers: [CatalogosController],
      providers: [{ provide: CatalogosService, useValue: catalogos }, JwtAuthGuard, RolesGuard],
    }).compile();

    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    jwt = mod.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  const cuentaValida = { codigo: 1240, descripcion: '  edificios  ', porcentaje: 5 };

  it('sin token responde 401', () => {
    return request(app.getHttpServer()).get('/catalogos/cuentas').expect(401);
  });

  it('rol Consultas puede listar cuentas', () => {
    return request(app.getHttpServer())
      .get('/catalogos/cuentas')
      .set('Authorization', `Bearer ${token(Rol.CONSULTAS)}`)
      .expect(200);
  });

  it('rol Consultas NO puede crear cuentas', async () => {
    await request(app.getHttpServer())
      .post('/catalogos/cuentas')
      .set('Authorization', `Bearer ${token(Rol.CONSULTAS)}`)
      .send(cuentaValida)
      .expect(403);
    expect(catalogos.crearCuenta).not.toHaveBeenCalled();
  });

  it('rol Auditoría NO puede ver periodos', () => {
    return request(app.getHttpServer())
      .get('/catalogos/periodos')
      .set('Authorization', `Bearer ${token(Rol.AUDITORIA)}`)
      .expect(403);
  });

  it('Operador crea cuenta; la descripción llega recortada y con el usuario del token', async () => {
    await request(app.getHttpServer())
      .post('/catalogos/cuentas')
      .set('Authorization', `Bearer ${token(Rol.OPERADOR)}`)
      .send(cuentaValida)
      .expect(201);
    expect(catalogos.crearCuenta).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: 1240, descripcion: 'edificios', porcentaje: 5 }),
      'prueba',
    );
  });

  it('cuenta con porcentaje decimal responde 400 (la columna es entera)', async () => {
    const res = await request(app.getHttpServer())
      .post('/catalogos/cuentas')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ ...cuentaValida, porcentaje: 12.5 })
      .expect(400);
    expect(res.body.message).toContain('El porcentaje de la cuenta debe ser un número entero');
  });

  it('división acepta porcentaje con 2 decimales', () => {
    return request(app.getHttpServer())
      .post('/catalogos/divisiones')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ codigo: 16, descripcion: 'MUELLE', porcentaje: 2.5 })
      .expect(201);
  });

  it('periodo con mes inválido responde 400', () => {
    return request(app.getHttpServer())
      .post('/catalogos/periodos')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ mes: '2026-13', estado: 'R' })
      .expect(400);
  });
});
