import { Module } from '@nestjs/common';
import { GraficasController } from './graficas.controller.js';
import { GraficasRepository } from './graficas.repository.js';

@Module({
  controllers: [GraficasController],
  providers: [GraficasRepository],
})
export class GraficasModule {}
