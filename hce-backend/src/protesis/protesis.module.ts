import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProtesisOrder } from './protesis-order.entity';
import { ProtesisChat } from './protesis-chat.entity';
import { ProtesisInsumo } from './protesis-insumo.entity';
import { ProtesisService } from './protesis.service';
import { ProtesisController } from './protesis.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProtesisOrder, ProtesisChat, ProtesisInsumo])],
  providers: [ProtesisService],
  controllers: [ProtesisController],
  exports: [ProtesisService],
})
export class ProtesisModule {}
