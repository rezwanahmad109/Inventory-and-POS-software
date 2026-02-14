import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FileAttachmentEntity } from '../database/entities/file-attachment.entity';
import { Expense } from '../database/entities/expense.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Sale } from '../database/entities/sale.entity';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([FileAttachmentEntity, Expense, Sale, Purchase]),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
