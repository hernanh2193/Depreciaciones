import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { JwtAuthGuard, RolesGuard } from './../src/auth/guards.js';
import { Rol } from './../src/auth/roles.js';
import { UsuariosController } from './../src/usuarios/usuarios.controller.js';
import { UsuariosService } from './../src/usuarios/usuarios.service.js';

// Capa HTTP de /usuarios con guards reales y servicio simulado (sin Oracle).
describe('UsuariosController (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const usuarios = {
    listar: vi.fn().mockResolvedValue([]),
    empleado: vi.fn().mockResolvedValue({}),
    obtener: vi.fn().mockResolvedValue({}),
    crear: vi.fn().mockResolvedValue({ usuario: 'x' }),
    actualizar: vi.fn().mockResolvedValue(undefined),
    restablecerClave: vi.fn().mockResolvedValue({ usuario: 'x' }),
  };
  const token = (rol: Rol) => jwt.sign({ sub: 'administrador', nombre: 'Admin', rol });
  const auth = (rol = Rol.ADMINISTRADOR) => ({ Authorization: `Bearer ${token(rol)}` });

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba' })],
      controllers: [UsuariosController],
      providers: [{ provide: UsuariosService, useValue: usuarios }, JwtAuthGuard, RolesGuard],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    jwt = mod.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([Rol.OPERADOR, Rol.CONSULTAS, Rol.AUDITORIA])('el rol %s no tiene acceso', async (rol) => {
    await request(app.getHttpServer()).get('/usuarios').set(auth(rol)).expect(403);
  });

  it('crear: pasa código y datos con el usuario del token', async () => {
    await request(app.getHttpServer())
      .post('/usuarios')
      .set(auth())
      .send({ codigo: 2524, rol: '2', estado: 'A', correo: '', observacion: ' Contabilidad ' })
      .expect(201);
    expect(usuarios.crear).toHaveBeenCalledWith(2524, { rol: '2', estado: 'A', correo: null, observacion: 'Contabilidad' }, 'administrador');
  });

  it('crear: no acepta un campo clave (la clave no se escribe)', async () => {
    await request(app.getHttpServer())
      .post('/usuarios')
      .set(auth())
      .send({ codigo: 2524, rol: '2', estado: 'A', clave: '123' })
      .expect(400);
    expect(usuarios.crear).not.toHaveBeenCalled();
  });

  it('correo de más de 40 caracteres: 400', async () => {
    await request(app.getHttpServer())
      .put('/usuarios/2524')
      .set(auth())
      .send({ rol: '2', estado: 'A', correo: `${'a'.repeat(30)}@puertoquetzal.gob.gt` })
      .expect(400);
  });

  it('rol no válido: 400', async () => {
    await request(app.getHttpServer()).put('/usuarios/2524').set(auth()).send({ rol: '9', estado: 'A' }).expect(400);
  });

  it('restablecer clave', async () => {
    await request(app.getHttpServer()).post('/usuarios/2524/restablecer-clave').set(auth()).expect(200);
    expect(usuarios.restablecerClave).toHaveBeenCalledWith(2524, 'administrador');
  });
});
