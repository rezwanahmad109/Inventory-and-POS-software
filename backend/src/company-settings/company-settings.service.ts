import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  BusinessProfileSetting,
  Setting,
} from '../database/entities/setting.entity';
import { UpdateCompanyBrandingDto } from './dto/update-company-branding.dto';
import { UpdateCompanyLocalizationDto } from './dto/update-company-localization.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

@Injectable()
export class CompanySettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) {}

  async getProfile(): Promise<BusinessProfileSetting> {
    const settings = await this.getOrCreateSettings();
    return settings.businessProfile ?? this.defaultProfile(settings);
  }

  async updateProfile(
    dto: UpdateCompanyProfileDto,
  ): Promise<BusinessProfileSetting> {
    const settings = await this.getOrCreateSettings();
    const current = settings.businessProfile ?? this.defaultProfile(settings);

    settings.businessProfile = {
      businessName: dto.businessName?.trim() ?? current.businessName,
      address: dto.address?.trim() ?? current.address,
      contactEmail: dto.contactEmail?.trim() ?? current.contactEmail,
      contactPhone: dto.contactPhone?.trim() ?? current.contactPhone,
      website: dto.website?.trim() ?? current.website,
      taxId: dto.taxId?.trim() ?? current.taxId,
    };
    settings.businessName = settings.businessProfile.businessName;

    const saved = await this.settingsRepository.save(settings);
    return saved.businessProfile ?? this.defaultProfile(saved);
  }

  async getBranding(): Promise<{
    primaryLogoUrl: string | null;
    secondaryLogoUrl: string | null;
    theme: string;
  }> {
    const settings = await this.getOrCreateSettings();
    return {
      primaryLogoUrl: settings.logoUrl ?? null,
      secondaryLogoUrl: settings.secondaryLogoUrl ?? null,
      theme: settings.theme,
    };
  }

  async updateBranding(dto: UpdateCompanyBrandingDto): Promise<{
    primaryLogoUrl: string | null;
    secondaryLogoUrl: string | null;
    theme: string;
  }> {
    const settings = await this.getOrCreateSettings();

    if (dto.primaryLogoUrl !== undefined) {
      settings.logoUrl = dto.primaryLogoUrl.trim();
    }
    if (dto.secondaryLogoUrl !== undefined) {
      settings.secondaryLogoUrl = dto.secondaryLogoUrl.trim();
    }
    if (dto.theme !== undefined) {
      settings.theme = dto.theme.trim();
    }

    const saved = await this.settingsRepository.save(settings);
    return {
      primaryLogoUrl: saved.logoUrl ?? null,
      secondaryLogoUrl: saved.secondaryLogoUrl ?? null,
      theme: saved.theme,
    };
  }

  async getLocalization(): Promise<{
    defaultCurrency: string;
    timeZone: string;
  }> {
    const settings = await this.getOrCreateSettings();
    return {
      defaultCurrency: settings.currency,
      timeZone: settings.timeZone,
    };
  }

  async updateLocalization(
    dto: UpdateCompanyLocalizationDto,
  ): Promise<{ defaultCurrency: string; timeZone: string }> {
    const settings = await this.getOrCreateSettings();

    if (dto.defaultCurrency !== undefined) {
      settings.currency = dto.defaultCurrency.toUpperCase().trim();
    }
    if (dto.timeZone !== undefined) {
      settings.timeZone = dto.timeZone.trim();
    }

    const saved = await this.settingsRepository.save(settings);
    return {
      defaultCurrency: saved.currency,
      timeZone: saved.timeZone,
    };
  }

  private async getOrCreateSettings(): Promise<Setting> {
    let settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepository.create({
        taxRate: 0,
        currency: 'USD',
        businessName: 'My Business',
        logoUrl: null,
        secondaryLogoUrl: null,
        footerNote: null,
        theme: 'default',
        timeZone: 'UTC',
        businessProfile: null,
        invoiceTemplate: null,
        taxSettings: null,
        discountRules: null,
        stockPolicy: null,
        currencies: null,
        paymentModes: null,
        emailNotificationSettings: null,
      });
      settings = await this.settingsRepository.save(settings);
    }

    if (!settings) {
      throw new NotFoundException('Company settings could not be initialized.');
    }

    return settings;
  }

  private defaultProfile(settings: Setting): BusinessProfileSetting {
    return {
      businessName: settings.businessName,
      address: null,
      contactEmail: null,
      contactPhone: null,
      website: null,
      taxId: null,
    };
  }
}
