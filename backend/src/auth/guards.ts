import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayload } from './auth.service.js';
import { Rol, ROLES_KEY } from './roles.js';

export type RequestConUsuario = Request & { user: JwtPayload };

/** Exige un header "Authorization: Bearer <token>" válido y deja el payload en req.user. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestConUsuario>();
    const [tipo, token] = req.headers.authorization?.split(' ') ?? [];
    if (tipo !== 'Bearer' || !token) {
      throw new UnauthorizedException('Sesión no válida');
    }
    try {
      req.user = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Sesión expirada, inicie sesión nuevamente');
    }
    return true;
  }
}

/** Verifica que el rol del usuario esté en @Roles(...). Sin @Roles permite a cualquier usuario autenticado. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const { user } = context.switchToHttp().getRequest<RequestConUsuario>();
    if (!roles.includes(user.rol)) {
      throw new ForbiddenException('No tiene permisos para esta opción');
    }
    return true;
  }
}
