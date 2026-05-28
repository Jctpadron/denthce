import { Module } from '@nestjs/common';
import { SisaService } from './sisa.service';
import { SisaController } from './sisa.controller';

@Module({
  controllers: [SisaController],
  providers: [SisaService],
  exports: [SisaService],
})
export class SisaModule {}
