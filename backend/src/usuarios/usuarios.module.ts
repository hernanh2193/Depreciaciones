import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosRepository } from './usuarios.repository.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, UsuariosRepository],
})
export class UsuariosModule {}
