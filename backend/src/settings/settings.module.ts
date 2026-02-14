import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from '../database/entities/audit-log.entity';
import { BranchProductEntity } from '../database/entities/branch-product.entity';
import { Setting } from '../database/entities/setting.entity';
import { ExportController } from './export.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Setting, AuditLog, BranchProductEntity])],
  controllers: [SettingsController, ExportController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
