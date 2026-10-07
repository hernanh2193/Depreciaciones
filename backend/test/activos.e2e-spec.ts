import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ActivosController } from './../src/activos/activos.controller.js';
import { ActivosService } from './../src/activos/activos.service.js';
import { JwtAuthGuard, RolesGuard } from './../src/auth/guards.js';
import { Rol } from './../src/auth/roles.js';

// Capa HTTP de /activos con los guards reales y el servicio simulado (sin Oracle).
describe('ActivosController (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const activos = {
    buscar: vi.fn().mockResolvedValue([]),
    crear: vi.fn().mockResolvedValue({ correlativo: 3065 }),
    obtener: vi.fn().mockResolvedValue({ correlativo: 3064 }),
    regenerar: vi.fn().mockResolvedValue({}),
  };
  const token = (rol: Rol) => jwt.sign({ sub: 'prueba', nombre: 'Prueba', rol });
  const valido = {
    relacion: 30,
    descripcion: '  compresor  ',
    tarjeta: '',
    cuentaPresupuesto: '',
    fechaInicio: '2025-12-12',
    valorOriginal: 89588.39,
    fechaConstancia: '',
    anio: '',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba' })],
      controllers: [ActivosController],
      providers: [{ provide: ActivosService, useValue: activos }, JwtAuthGuard, RolesGuard],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    jwt = mod.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('rol Consultas no tiene acceso a activos', () => {
    return request(app.getHttpServer()).get('/activos').set('Authorization', `Bearer ${token(Rol.CONSULTAS)}`).expect(403);
  });

  it('crea: recorta la descripción y convierte campos vacíos en null', async () => {
    await request(app.getHttpServer())
      .post('/activos')
      .set('Authorization', `Bearer ${token(Rol.OPERADOR)}`)
      .send(valido)
      .expect(201);
    expect(activos.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        descripcion: 'compresor',
        tarjeta: null,
        cuentaPresupuesto: null,
        fechaConstancia: null,
        anio: null,
        noCur: null,
      }),
      'prueba',
    );
  });

  it('valor original de Q1.00 o menos responde 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/activos')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ ...valido, valorOriginal: 1 })
      .expect(400);
    expect(res.body.message.join(' ')).toContain('mayor que Q1.00');
  });

  it('fecha con formato inválido responde 400', () => {
    return request(app.getHttpServer())
      .post('/activos')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ ...valido, fechaInicio: '12/12/2025' })
      .expect(400);
  });

  it('búsqueda convierte el límite a número', async () => {
    await request(app.getHttpServer())
      .get('/activos?texto=compresor&limite=20')
      .set('Authorization', `Bearer ${token(Rol.OPERADOR)}`)
      .expect(200);
    expect(activos.buscar).toHaveBeenCalledWith(expect.objectContaining({ texto: 'compresor', limite: 20, estado: null }));
  });

  it('id no numérico responde 400', () => {
    return request(app.getHttpServer()).get('/activos/abc').set('Authorization', `Bearer ${token(Rol.OPERADOR)}`).expect(400);
  });
});
