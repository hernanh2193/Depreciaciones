import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import oracledb from 'oracledb';

/**
 * Pool de conexiones a Oracle. Por defecto modo thin (sin Instant Client);
 * con ORACLE_CLIENT_DIR usa modo thick.
 * Usar siempre bind variables (:nombre) en lugar de concatenar valores en el SQL.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: oracledb.Pool;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    // Modo thick: necesario si el usuario de BD tiene verificador de clave 10G (error NJS-116).
    const clientDir = this.config.get<string>('ORACLE_CLIENT_DIR');
    if (clientDir) {
      oracledb.initOracleClient({ libDir: clientDir });
      this.logger.log(`Modo thick con Oracle Client en ${clientDir}`);
    }

    const host = this.config.getOrThrow<string>('DB_HOST');
    const port = this.config.get<string>('DB_PORT', '1521');
    const service = this.config.getOrThrow<string>('DB_SERVICE');

    this.pool = await oracledb.createPool({
      user: this.config.getOrThrow<string>('DB_USER'),
      password: this.config.getOrThrow<string>('DB_PASSWORD'),
      connectString: `${host}:${port}/${service}`,
      poolMin: 1,
      poolMax: 10,
    });
    this.logger.log(`Pool Oracle creado (${host}:${port}/${service})`);
  }

  async onModuleDestroy() {
    await this.pool?.close(10);
  }

  /** Ejecuta un SELECT y devuelve las filas como objetos (columnas en MAYÚSCULAS). */
  async query<T>(sql: string, binds: oracledb.BindParameters = {}): Promise<T[]> {
    const conn = await this.pool.getConnection();
    try {
      const result = await conn.execute<T>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return result.rows ?? [];
    } finally {
      await conn.close();
    }
  }

  /** Ejecuta INSERT/UPDATE/DELETE o un bloque PL/SQL con autocommit. */
  async execute<T = unknown>(
    sql: string,
    binds: oracledb.BindParameters = {},
  ): Promise<oracledb.Result<T>> {
    const conn = await this.pool.getConnection();
    try {
      return await conn.execute<T>(sql, binds, { autoCommit: true });
    } finally {
      await conn.close();
    }
  }

  /** Ejecuta varias sentencias en una sola transacción: commit si todo sale bien, rollback si falla. */
  async transaction<T>(fn: (conn: oracledb.Connection) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      await conn.close();
    }
  }
}

/** Código ORA-xxxxx de un error de Oracle, o de un texto que lo contenga (p. ej. la salida de un procedimiento). */
export function codigoOracle(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'errorNum' in err) {
    return Number((err as { errorNum: number }).errorNum) || undefined;
  }
  const texto = typeof err === 'string' ? err : err instanceof Error ? err.message : '';
  const m = /ORA-(\d{5})/.exec(texto);
  return m ? Number(m[1]) : undefined;
}

export const ORA_REGISTRO_DUPLICADO = 1;
export const ORA_PADRE_NO_EXISTE = 2291;
