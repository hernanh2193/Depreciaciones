import { Module } from '@nestjs/common';
import { ActivosController } from './activos.controller.js';
import { ActivosRepository } from './activos.repository.js';
import { ActivosService } from './activos.service.js';

@Module({
  controllers: [ActivosController],
  providers: [ActivosService, ActivosRepository],
})
export class ActivosModule {}
