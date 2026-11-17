import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service.js';
import { ReportesController } from './reportes.controller.js';
import { ReportesRepository } from './reportes.repository.js';
import { ReportesService } from './reportes.service.js';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService, ReportesRepository, PdfService],
})
export class ReportesModule {}
