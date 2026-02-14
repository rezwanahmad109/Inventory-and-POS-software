import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Setting } from '../database/entities/setting.entity';
import {
  AuditLogQueryDto,
  UpdateCurrenciesDto,
  UpdateBusinessProfileDto,
  UpdateDiscountRulesDto,
  UpdateEmailNotificationSettingsDto,
  UpdateInvoiceTemplateDto,
  UpdatePaymentModesDto,
  UpdateStockPolicyDto,
  UpdateTaxSettingsDto,
} from './dto/settings-sections.dto';
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

  @Get('business-profile')
  @Permissions('settings.read')
  async getBusinessProfile() {
    return this.settingsService.getBusinessProfile();
  }

  @Put('business-profile')
  @Permissions('settings.update')
  async updateBusinessProfile(@Body() dto: UpdateBusinessProfileDto) {
    return this.settingsService.updateBusinessProfile(dto);
  }

  @Get('invoice-template')
  @Permissions('settings.read')
  async getInvoiceTemplate() {
    return this.settingsService.getInvoiceTemplate();
  }

  @Put('invoice-template')
  @Permissions('settings.update')
  async updateInvoiceTemplate(@Body() dto: UpdateInvoiceTemplateDto) {
    return this.settingsService.updateInvoiceTemplate(dto);
  }

  @Get('tax')
  @Permissions('settings.read')
  async getTaxSettings() {
    return this.settingsService.getTaxSettings();
  }

  @Put('tax')
  @Permissions('settings.update')
  async updateTaxSettings(@Body() dto: UpdateTaxSettingsDto) {
    return this.settingsService.updateTaxSettings(dto);
  }

  @Get('discount-rules')
  @Permissions('settings.read')
  async getDiscountRules() {
    return this.settingsService.getDiscountRules();
  }

  @Put('discount-rules')
  @Permissions('settings.update')
  async updateDiscountRules(@Body() dto: UpdateDiscountRulesDto) {
    return this.settingsService.updateDiscountRules(dto);
  }

  @Get('stock-policy')
  @Permissions('settings.read')
  async getStockPolicy() {
    return this.settingsService.getStockPolicy();
  }

  @Put('stock-policy')
  @Permissions('settings.update')
  async updateStockPolicy(@Body() dto: UpdateStockPolicyDto) {
    return this.settingsService.updateStockPolicy(dto);
  }

  @Get('currencies')
  @Permissions('settings.read')
  async getCurrencies() {
    return this.settingsService.getCurrencies();
  }

  @Put('currencies')
  @Permissions('settings.update')
  async updateCurrencies(@Body() dto: UpdateCurrenciesDto) {
    return this.settingsService.updateCurrencies(dto);
  }

  @Get('payment-modes')
  @Permissions('settings.read')
  async getPaymentModes() {
    return this.settingsService.getPaymentModes();
  }

  @Put('payment-modes')
  @Permissions('settings.update')
  async updatePaymentModes(@Body() dto: UpdatePaymentModesDto) {
    return this.settingsService.updatePaymentModes(dto);
  }

  @Get('email-notifications')
  @Permissions('settings.read')
  async getEmailNotificationSettings() {
    return this.settingsService.getEmailNotificationSettings();
  }

  @Put('email-notifications')
  @Permissions('settings.update')
  async updateEmailNotificationSettings(
    @Body() dto: UpdateEmailNotificationSettingsDto,
  ) {
    return this.settingsService.updateEmailNotificationSettings(dto);
  }

  @Get('audit-logs')
  @Permissions('audit_logs.read')
  async getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.settingsService.getAuditLogs(query);
  }
}
