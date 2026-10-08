import { Module } from '@nestjs/common';
import { ProcesosController } from './procesos.controller.js';
import { ProcesosRepository } from './procesos.repository.js';
import { ProcesosService } from './procesos.service.js';

@Module({
  controllers: [ProcesosController],
  providers: [ProcesosService, ProcesosRepository],
})
export class ProcesosModule {}
