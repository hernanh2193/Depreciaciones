import { Module } from '@nestjs/common';
import { ActivosModule } from '../activos/activos.module.js';
import { ConsultasController } from './consultas.controller.js';
import { ConsultasRepository } from './consultas.repository.js';

@Module({
  imports: [ActivosModule],
  controllers: [ConsultasController],
  providers: [ConsultasRepository],
})
export class ConsultasModule {}
