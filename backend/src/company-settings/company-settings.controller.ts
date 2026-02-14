import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanyBrandingDto } from './dto/update-company-branding.dto';
import { UpdateCompanyLocalizationDto } from './dto/update-company-localization.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

@Controller('company-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanySettingsController {
  constructor(private readonly companySettingsService: CompanySettingsService) {}

  @Get('profile')
  @Permissions('company_settings.read')
  getProfile() {
    return this.companySettingsService.getProfile();
  }

  @Put('profile')
  @Permissions('company_settings.update')
  updateProfile(@Body() dto: UpdateCompanyProfileDto) {
    return this.companySettingsService.updateProfile(dto);
  }

  @Get('branding')
  @Permissions('company_settings.read')
  getBranding() {
    return this.companySettingsService.getBranding();
  }

  @Put('branding')
  @Permissions('company_settings.update')
  updateBranding(@Body() dto: UpdateCompanyBrandingDto) {
    return this.companySettingsService.updateBranding(dto);
  }

  @Get('localization')
  @Permissions('company_settings.read')
  getLocalization() {
    return this.companySettingsService.getLocalization();
  }

  @Put('localization')
  @Permissions('company_settings.update')
  updateLocalization(@Body() dto: UpdateCompanyLocalizationDto) {
    return this.companySettingsService.updateLocalization(dto);
  }
}
