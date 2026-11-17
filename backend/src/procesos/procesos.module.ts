import { Module } from '@nestjs/common';
import { PonerAlDiaService } from './poner-al-dia.service.js';
import { ProcesosController } from './procesos.controller.js';
import { ProcesosRepository } from './procesos.repository.js';
import { ProcesosService } from './procesos.service.js';

@Module({
  controllers: [ProcesosController],
  providers: [ProcesosService, PonerAlDiaService, ProcesosRepository],
})
export class ProcesosModule {}
