import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { JwtAuthGuard, RolesGuard } from './../src/auth/guards.js';
import { Rol } from './../src/auth/roles.js';
import { ReportesController } from './../src/reportes/reportes.controller.js';
import { ReportesService } from './../src/reportes/reportes.service.js';

// Capa HTTP de /reportes con guards reales y el servicio simulado (sin Oracle ni pdfmake).
describe('ReportesController (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const pdf = { nombre: 'prueba.pdf', contenido: Buffer.from('%PDF-1.4 prueba') };
  const reportes = {
    opciones: vi.fn().mockResolvedValue({ cuentas: [], relaciones: [] }),
    catalogoCuentas: vi.fn().mockResolvedValue(pdf),
    acumuladoMensual: vi.fn().mockResolvedValue(pdf),
    consolidacionAnual: vi.fn().mockResolvedValue(pdf),
  };
  const token = (rol: Rol) => jwt.sign({ sub: 'prueba', nombre: 'Prueba', rol });

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba' })],
      controllers: [ReportesController],
      providers: [{ provide: ReportesService, useValue: reportes }, JwtAuthGuard, RolesGuard],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    jwt = mod.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('Auditoría puede generar reportes y recibe un PDF inline', async () => {
    const res = await request(app.getHttpServer())
      .get('/reportes/catalogo-cuentas')
      .set('Authorization', `Bearer ${token(Rol.AUDITORIA)}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toBe('inline; filename="prueba.pdf"');
  });

  it('pasa año y mes como números', async () => {
    await request(app.getHttpServer())
      .get('/reportes/acumulado-mensual?anio=2026&mes=8')
      .set('Authorization', `Bearer ${token(Rol.CONSULTAS)}`)
      .expect(200);
    expect(reportes.acumuladoMensual).toHaveBeenCalledWith(2026, 8, 'prueba');
  });

  it('falta un parámetro: 400', () => {
    return request(app.getHttpServer())
      .get('/reportes/consolidacion?anio=2025')
      .set('Authorization', `Bearer ${token(Rol.OPERADOR)}`)
      .expect(400);
  });

  it('parámetro no numérico: 400', () => {
    return request(app.getHttpServer())
      .get('/reportes/acumulado-mensual?anio=abc&mes=8')
      .set('Authorization', `Bearer ${token(Rol.OPERADOR)}`)
      .expect(400);
  });

  it('reporte inexistente: 404', () => {
    return request(app.getHttpServer())
      .get('/reportes/no-existe')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .expect(404);
  });

  it('sin token: 401', () => {
    return request(app.getHttpServer()).get('/reportes/catalogo-cuentas').expect(401);
  });
});
