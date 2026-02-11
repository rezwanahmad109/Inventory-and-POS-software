import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Setting } from '../database/entities/setting.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) {}

  /**
   * Ensure a default settings row exists on module initialization.
   * If no row is present, create one with sensible defaults.
   */
  async onModuleInit(): Promise<void> {
    const count = await this.settingsRepository.count();
    if (count === 0) {
      const defaults = this.settingsRepository.create({
        taxRate: 0,
        currency: 'USD',
        businessName: 'My Business',
        logoUrl: null,
        footerNote: null,
      });
      await this.settingsRepository.save(defaults);
    }
  }

  /**
   * Fetch the singleton settings record.
   * @returns The current settings object.
   * @throws NotFoundException if no settings row exists (should not happen after init).
   */
  async getSettings(): Promise<Setting> {
    const settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      throw new NotFoundException('Settings not found. Please initialize settings first.');
    }
    return settings;
  }

  /**
   * Update the singleton settings record using upsert logic.
   * Merges the provided fields into the existing record and saves.
   * @param dto - Partial settings fields to update.
   * @returns The updated settings object.
   */
  async updateSettings(dto: UpdateSettingsDto): Promise<Setting> {
    let settings = await this.settingsRepository.findOne({ where: {} });

    if (!settings) {
      // Create if somehow missing (defensive)
      settings = this.settingsRepository.create({
        taxRate: dto.taxRate ?? 0,
        currency: dto.currency ?? 'USD',
        businessName: dto.businessName ?? 'My Business',
        logoUrl: dto.logoUrl ?? null,
        footerNote: dto.footerNote ?? null,
      });
    } else {
      // Merge only provided fields
      if (dto.taxRate !== undefined) settings.taxRate = dto.taxRate;
      if (dto.currency !== undefined) settings.currency = dto.currency;
      if (dto.logoUrl !== undefined) settings.logoUrl = dto.logoUrl;
      if (dto.businessName !== undefined) settings.businessName = dto.businessName;
      if (dto.footerNote !== undefined) settings.footerNote = dto.footerNote;
    }

    return this.settingsRepository.save(settings);
  }
}
