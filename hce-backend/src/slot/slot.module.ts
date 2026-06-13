import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlotController } from './slot.controller';
import { SlotService } from './slot.service';
import { AppointmentEntity } from '../appointment/appointment.entity';
import { TenantConfigEntity } from '../tenant/tenant-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppointmentEntity, TenantConfigEntity]),
  ],
  controllers: [SlotController],
  providers: [SlotService],
  exports: [SlotService],
})
export class SlotModule {}
