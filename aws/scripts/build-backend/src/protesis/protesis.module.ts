import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProtesisOrder } from './protesis-order.entity';
import { ProtesisChat } from './protesis-chat.entity';
import { ProtesisInsumo } from './protesis-insumo.entity';
import { ProtesisStatusHistory } from './protesis-status-history.entity';
import { ProtesisPago } from './protesis-pago.entity';
import { ProtesisConsumoInsumo } from './protesis-consumo-insumo.entity';
import { ProtesisService } from './protesis.service';
import { ProtesisController } from './protesis.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProtesisOrder, ProtesisChat, ProtesisInsumo, ProtesisStatusHistory, ProtesisPago, ProtesisConsumoInsumo])],
  providers: [ProtesisService],
  controllers: [ProtesisController],
  exports: [ProtesisService],
})
export class ProtesisModule {}
