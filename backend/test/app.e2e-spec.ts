import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AuthController } from './../src/auth/auth.controller.js';
import { AuthService } from './../src/auth/auth.service.js';
import { JwtAuthGuard } from './../src/auth/guards.js';

// Prueba la capa HTTP de /auth sin conectarse a Oracle.
describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  const authService = { login: vi.fn(), cambiarClave: vi.fn() };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => false })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  it('POST /auth/login sin datos responde 400', () => {
    return request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
  });

  it('POST /auth/login con datos llama al servicio', async () => {
    authService.login.mockResolvedValue({ requiereCambio: true });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'jperez', clave: 'x' })
      .expect(200)
      .expect({ requiereCambio: true });
    expect(authService.login).toHaveBeenCalledWith('jperez', 'x');
  });

  it('GET /auth/me sin token es rechazado', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(403);
  });

  afterEach(async () => {
    await app.close();
  });
});
