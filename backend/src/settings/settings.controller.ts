import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Setting } from '../database/entities/setting.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('settings.read')
  async getSettings(): Promise<Setting> {
    return this.settingsService.getSettings();
  }

  @Put()
  @Permissions('settings.update')
  async updateSettings(@Body() dto: UpdateSettingsDto): Promise<Setting> {
    return this.settingsService.updateSettings(dto);
  }
}
