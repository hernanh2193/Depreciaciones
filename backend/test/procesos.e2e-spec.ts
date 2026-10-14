import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { JwtAuthGuard, RolesGuard } from './../src/auth/guards.js';
import { Rol } from './../src/auth/roles.js';
import { PonerAlDiaService } from './../src/procesos/poner-al-dia.service.js';
import { ProcesosController } from './../src/procesos/procesos.controller.js';
import { ProcesosService } from './../src/procesos/procesos.service.js';

// Capa HTTP de /procesos/depreciacion con guards reales y servicios simulados (sin Oracle).
describe('ProcesosController (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const procesos = { resumen: vi.fn().mockResolvedValue([]), vista: vi.fn().mockResolvedValue({}), generar: vi.fn().mockResolvedValue({}) };
  const ponerAlDia = { vista: vi.fn().mockResolvedValue({}), iniciar: vi.fn().mockResolvedValue({ fase: 'sin-detalle' }), estado: vi.fn() };
  const token = (rol: Rol) => jwt.sign({ sub: 'prueba', nombre: 'Prueba', rol });

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba' })],
      controllers: [ProcesosController],
      providers: [
        { provide: ProcesosService, useValue: procesos },
        { provide: PonerAlDiaService, useValue: ponerAlDia },
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

  it('rol Consultas no tiene acceso', () => {
    return request(app.getHttpServer())
      .get('/procesos/depreciacion/resumen')
      .set('Authorization', `Bearer ${token(Rol.CONSULTAS)}`)
      .expect(403);
  });

  it('periodo inválido en la vista responde 400', () => {
    return request(app.getHttpServer())
      .get('/procesos/depreciacion/vista?cuenta=1232&periodo=202613')
      .set('Authorization', `Bearer ${token(Rol.OPERADOR)}`)
      .expect(400);
  });

  it('generar pasa la confirmación de advertencias', async () => {
    await request(app.getHttpServer())
      .post('/procesos/depreciacion/generar')
      .set('Authorization', `Bearer ${token(Rol.OPERADOR)}`)
      .send({ cuenta: 1232, periodo: 202609, aceptarAdvertencias: true })
      .expect(200);
    expect(procesos.generar).toHaveBeenCalledWith(1232, 202609, true, 'prueba');
  });

  it('poner al día responde 202 y usa el usuario del token', async () => {
    await request(app.getHttpServer())
      .post('/procesos/depreciacion/poner-al-dia')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ cuenta: 1235 })
      .expect(202);
    expect(ponerAlDia.iniciar).toHaveBeenCalledWith(1235, 'prueba');
  });

  it('poner al día sin cuenta responde 400', () => {
    return request(app.getHttpServer())
      .post('/procesos/depreciacion/poner-al-dia')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({})
      .expect(400);
  });
});
