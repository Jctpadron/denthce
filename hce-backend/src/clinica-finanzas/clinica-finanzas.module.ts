import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalPrecio } from './clinical-precio.entity';
import { ClinicalPresupuesto } from './clinical-presupuesto.entity';
import { ClinicalPresupuestoItem } from './clinical-presupuesto-item.entity';
import { ClinicalPago } from './clinical-pago.entity';
import { ClinicalGasto } from './clinical-gasto.entity';
import { ClinicaFinanzasService } from './clinica-finanzas.service';
import { ClinicaFinanzasController } from './clinica-finanzas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClinicalPrecio, ClinicalPresupuesto, ClinicalPresupuestoItem, ClinicalPago, ClinicalGasto])],
  providers: [ClinicaFinanzasService],
  controllers: [ClinicaFinanzasController],
  exports: [ClinicaFinanzasService],
})
export class ClinicaFinanzasModule {}
