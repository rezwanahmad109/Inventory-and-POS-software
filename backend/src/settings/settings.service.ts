import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { AuditLog } from '../database/entities/audit-log.entity';
import { BranchProductEntity } from '../database/entities/branch-product.entity';
import {
  BusinessProfileSetting,
  DiscountRuleSetting,
  InvoiceTemplateSetting,
  Setting,
  StockPolicySetting,
  TaxRateSetting,
} from '../database/entities/setting.entity';
import {
  AuditLogQueryDto,
  DiscountRuleDto,
  ExportQueryDto,
  UpdateBusinessProfileDto,
  UpdateDiscountRulesDto,
  UpdateInvoiceTemplateDto,
  UpdateStockPolicyDto,
  UpdateTaxSettingsDto,
} from './dto/settings-sections.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export type ExportDataset = NonNullable<ExportQueryDto['dataset']>;

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
    @InjectRepository(AuditLog)
    private readonly auditLogsRepository: Repository<AuditLog>,
    @InjectRepository(BranchProductEntity)
    private readonly branchProductsRepository: Repository<BranchProductEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      const defaults = this.createDefaultSettingsEntity();
      await this.settingsRepository.save(defaults);
      return;
    }

    const patched = this.applyDefaultSections(settings);
    if (patched) {
      await this.settingsRepository.save(settings);
    }
  }

  async getSettings(): Promise<Setting> {
    return this.getOrCreateSettings();
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<Setting> {
    const settings = await this.getOrCreateSettings();

    if (dto.taxRate !== undefined) settings.taxRate = dto.taxRate;
    if (dto.currency !== undefined) settings.currency = dto.currency;
    if (dto.logoUrl !== undefined) settings.logoUrl = dto.logoUrl;
    if (dto.businessName !== undefined) settings.businessName = dto.businessName;
    if (dto.footerNote !== undefined) settings.footerNote = dto.footerNote;

    if (dto.businessProfile) {
      settings.businessProfile = this.mergeBusinessProfile(
        settings,
        dto.businessProfile as Partial<BusinessProfileSetting>,
      );
      settings.businessName = settings.businessProfile.businessName;
    }

    if (dto.invoiceTemplate) {
      settings.invoiceTemplate = this.mergeInvoiceTemplate(
        settings,
        dto.invoiceTemplate as Partial<InvoiceTemplateSetting>,
      );
      settings.logoUrl = settings.invoiceTemplate.logoUrl;
      settings.footerNote = settings.invoiceTemplate.footerText;
    }

    if (dto.taxSettings) {
      settings.taxSettings = this.normalizeTaxRates(
        dto.taxSettings as Array<Partial<TaxRateSetting>>,
      );
      settings.taxRate = settings.taxSettings[0]?.taxRate ?? 0;
    }

    if (dto.discountRules) {
      settings.discountRules = this.normalizeDiscountRules(
        dto.discountRules as Array<Partial<DiscountRuleSetting>>,
      );
    }

    if (dto.stockPolicy) {
      settings.stockPolicy = this.mergeStockPolicy(
        settings,
        dto.stockPolicy as Partial<StockPolicySetting>,
      );
    }

    return this.settingsRepository.save(settings);
  }

  async getBusinessProfile(): Promise<BusinessProfileSetting> {
    const settings = await this.getOrCreateSettings();
    return this.resolveBusinessProfile(settings);
  }

  async updateBusinessProfile(
    dto: UpdateBusinessProfileDto,
  ): Promise<BusinessProfileSetting> {
    const settings = await this.getOrCreateSettings();
    settings.businessProfile = this.mergeBusinessProfile(settings, dto);
    settings.businessName = settings.businessProfile.businessName;
    await this.settingsRepository.save(settings);
    return settings.businessProfile;
  }

  async getInvoiceTemplate(): Promise<InvoiceTemplateSetting> {
    const settings = await this.getOrCreateSettings();
    return this.resolveInvoiceTemplate(settings);
  }

  async updateInvoiceTemplate(
    dto: UpdateInvoiceTemplateDto,
  ): Promise<InvoiceTemplateSetting> {
    const settings = await this.getOrCreateSettings();
    settings.invoiceTemplate = this.mergeInvoiceTemplate(settings, dto);
    settings.logoUrl = settings.invoiceTemplate.logoUrl;
    settings.footerNote = settings.invoiceTemplate.footerText;
    await this.settingsRepository.save(settings);
    return settings.invoiceTemplate;
  }

  async getTaxSettings(): Promise<TaxRateSetting[]> {
    const settings = await this.getOrCreateSettings();
    return this.resolveTaxSettings(settings);
  }

  async updateTaxSettings(dto: UpdateTaxSettingsDto): Promise<TaxRateSetting[]> {
    const settings = await this.getOrCreateSettings();
    settings.taxSettings = this.normalizeTaxRates(dto.rates);
    settings.taxRate = settings.taxSettings[0]?.taxRate ?? 0;
    await this.settingsRepository.save(settings);
    return settings.taxSettings;
  }

  async getDiscountRules(): Promise<DiscountRuleSetting[]> {
    const settings = await this.getOrCreateSettings();
    return this.resolveDiscountRules(settings);
  }

  async updateDiscountRules(
    dto: UpdateDiscountRulesDto,
  ): Promise<DiscountRuleSetting[]> {
    const settings = await this.getOrCreateSettings();
    settings.discountRules = this.normalizeDiscountRules(dto.rules);
    await this.settingsRepository.save(settings);
    return settings.discountRules;
  }

  async getStockPolicy(): Promise<StockPolicySetting> {
    const settings = await this.getOrCreateSettings();
    return this.resolveStockPolicy(settings);
  }

  async updateStockPolicy(dto: UpdateStockPolicyDto): Promise<StockPolicySetting> {
    const settings = await this.getOrCreateSettings();
    settings.stockPolicy = this.mergeStockPolicy(settings, dto);
    await this.settingsRepository.save(settings);
    return settings.stockPolicy;
  }

  async getAuditLogs(query: AuditLogQueryDto): Promise<AuditLog[]> {
    const qb = this.auditLogsRepository
      .createQueryBuilder('audit')
      .orderBy('audit.created_at', 'DESC')
      .take(query.limit ?? 100);

    if (query.action) {
      qb.andWhere('LOWER(audit.action) = LOWER(:action)', {
        action: query.action.trim(),
      });
    }
    if (query.entity) {
      qb.andWhere('LOWER(audit.entity) = LOWER(:entity)', {
        entity: query.entity.trim(),
      });
    }
    if (query.actorId) {
      qb.andWhere('audit.actor_id = :actorId', { actorId: query.actorId });
    }
    if (query.from) {
      const from = this.parseDateOrFail(query.from, 'from');
      qb.andWhere('audit.created_at >= :from', { from: from.toISOString() });
    }
    if (query.to) {
      const to = this.parseDateOrFail(query.to, 'to');
      qb.andWhere('audit.created_at <= :to', { to: to.toISOString() });
    }

    return qb.getMany();
  }

  async buildExportDataset(
    dataset: ExportDataset,
  ): Promise<Array<Record<string, unknown>>> {
    switch (dataset) {
      case 'settings': {
        const businessProfile = await this.getBusinessProfile();
        const invoiceTemplate = await this.getInvoiceTemplate();
        const stockPolicy = await this.getStockPolicy();
        const settings = await this.getSettings();

        return [
          {
            section: 'business_profile',
            ...businessProfile,
          },
          {
            section: 'invoice_template',
            ...invoiceTemplate,
          },
          {
            section: 'stock_policy',
            ...stockPolicy,
          },
          {
            section: 'general',
            currency: settings.currency,
            taxRate: settings.taxRate,
          },
        ];
      }
      case 'tax':
        return (await this.getTaxSettings()).map((rate) => ({ ...rate }));
      case 'discount_rules':
        return (await this.getDiscountRules()).map((rule) => ({ ...rule }));
      case 'inventory_low_stock': {
        const rows = await this.branchProductsRepository
          .createQueryBuilder('branchProduct')
          .leftJoin('branchProduct.product', 'product')
          .leftJoin('branchProduct.branch', 'branch')
          .select('branchProduct.id', 'id')
          .addSelect('branch.id', 'branchId')
          .addSelect('branch.name', 'branchName')
          .addSelect('product.id', 'productId')
          .addSelect('product.name', 'productName')
          .addSelect('product.sku', 'sku')
          .addSelect('branchProduct.stock_quantity', 'stockQuantity')
          .addSelect('branchProduct.low_stock_threshold', 'lowStockThreshold')
          .where('branchProduct.low_stock_threshold > 0')
          .andWhere('branchProduct.stock_quantity <= branchProduct.low_stock_threshold')
          .andWhere('branch.is_active = true')
          .orderBy('branchProduct.stock_quantity', 'ASC')
          .getRawMany<Record<string, unknown>>();

        return rows;
      }
      default:
        return [];
    }
  }

  private createDefaultSettingsEntity(): Setting {
    const settings = this.settingsRepository.create({
      taxRate: 0,
      currency: 'USD',
      businessName: 'My Business',
      logoUrl: null,
      footerNote: null,
      businessProfile: null,
      invoiceTemplate: null,
      taxSettings: null,
      discountRules: null,
      stockPolicy: null,
    });

    this.applyDefaultSections(settings);
    return settings;
  }

  private applyDefaultSections(settings: Setting): boolean {
    let updated = false;

    if (!settings.businessProfile) {
      settings.businessProfile = this.defaultBusinessProfile(settings);
      updated = true;
    }
    if (!settings.invoiceTemplate) {
      settings.invoiceTemplate = this.defaultInvoiceTemplate(settings);
      updated = true;
    }
    if (!settings.taxSettings) {
      settings.taxSettings = this.defaultTaxSettings(settings);
      updated = true;
    }
    if (!settings.discountRules) {
      settings.discountRules = [];
      updated = true;
    }
    if (!settings.stockPolicy) {
      settings.stockPolicy = this.defaultStockPolicy();
      updated = true;
    }

    return updated;
  }

  private async getOrCreateSettings(): Promise<Setting> {
    let settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.createDefaultSettingsEntity();
      return this.settingsRepository.save(settings);
    }

    const patched = this.applyDefaultSections(settings);
    if (patched) {
      settings = await this.settingsRepository.save(settings);
    }

    if (!settings) {
      throw new NotFoundException('Settings could not be initialized.');
    }

    return settings;
  }

  private resolveBusinessProfile(settings: Setting): BusinessProfileSetting {
    return settings.businessProfile ?? this.defaultBusinessProfile(settings);
  }

  private resolveInvoiceTemplate(settings: Setting): InvoiceTemplateSetting {
    return settings.invoiceTemplate ?? this.defaultInvoiceTemplate(settings);
  }

  private resolveTaxSettings(settings: Setting): TaxRateSetting[] {
    return settings.taxSettings ?? this.defaultTaxSettings(settings);
  }

  private resolveDiscountRules(settings: Setting): DiscountRuleSetting[] {
    return settings.discountRules ?? [];
  }

  private resolveStockPolicy(settings: Setting): StockPolicySetting {
    return settings.stockPolicy ?? this.defaultStockPolicy();
  }

  private mergeBusinessProfile(
    settings: Setting,
    patch: Partial<BusinessProfileSetting>,
  ): BusinessProfileSetting {
    const current = this.resolveBusinessProfile(settings);

    return {
      businessName: this.normalizeRequiredString(
        patch.businessName,
        current.businessName,
      ),
      address: this.normalizeNullableString(patch.address, current.address),
      contactEmail: this.normalizeNullableString(
        patch.contactEmail,
        current.contactEmail,
      ),
      contactPhone: this.normalizeNullableString(
        patch.contactPhone,
        current.contactPhone,
      ),
      website: this.normalizeNullableString(patch.website, current.website),
      taxId: this.normalizeNullableString(patch.taxId, current.taxId),
    };
  }

  private mergeInvoiceTemplate(
    settings: Setting,
    patch: Partial<InvoiceTemplateSetting>,
  ): InvoiceTemplateSetting {
    const current = this.resolveInvoiceTemplate(settings);
    const nextNumber =
      patch.nextNumber !== undefined && patch.nextNumber > 0
        ? Math.floor(patch.nextNumber)
        : current.nextNumber;

    return {
      headerText: this.normalizeNullableString(patch.headerText, current.headerText),
      footerText: this.normalizeNullableString(patch.footerText, current.footerText),
      logoUrl: this.normalizeNullableString(patch.logoUrl, current.logoUrl),
      invoicePrefix: this.normalizeRequiredString(
        patch.invoicePrefix,
        current.invoicePrefix,
      ),
      nextNumber,
    };
  }

  private normalizeTaxRates(
    rates: Array<Partial<TaxRateSetting>>,
  ): TaxRateSetting[] {
    if (rates.length === 0) {
      return [];
    }

    return rates.map((rate) => ({
      branchId: rate.branchId ?? null,
      taxName: this.normalizeRequiredString(rate.taxName, 'VAT'),
      taxRate: this.normalizeRate(rate.taxRate),
      isInclusive: Boolean(rate.isInclusive),
    }));
  }

  private normalizeDiscountRules(
    rules: Array<Partial<DiscountRuleSetting> | DiscountRuleDto>,
  ): DiscountRuleSetting[] {
    if (rules.length === 0) {
      return [];
    }

    return rules.map((rule) => ({
      id: this.normalizeRequiredString(rule.id, randomUUID()),
      name: this.normalizeRequiredString(rule.name, 'Untitled Rule'),
      discountType: rule.discountType === 'fixed' ? 'fixed' : 'percentage',
      value: Math.max(0, Number(rule.value ?? 0)),
      appliesToCategoryId: rule.appliesToCategoryId ?? null,
      appliesToProductId: rule.appliesToProductId ?? null,
      isActive: rule.isActive !== false,
    }));
  }

  private mergeStockPolicy(
    settings: Setting,
    patch: Partial<StockPolicySetting>,
  ): StockPolicySetting {
    const current = this.resolveStockPolicy(settings);
    return {
      defaultLowStockThreshold:
        patch.defaultLowStockThreshold !== undefined &&
        patch.defaultLowStockThreshold >= 0
          ? Math.floor(patch.defaultLowStockThreshold)
          : current.defaultLowStockThreshold,
      allowStockTransfers:
        patch.allowStockTransfers ?? current.allowStockTransfers,
      allowNegativeStock:
        patch.allowNegativeStock ?? current.allowNegativeStock,
      autoReorderEnabled:
        patch.autoReorderEnabled ?? current.autoReorderEnabled,
    };
  }

  private defaultBusinessProfile(settings: Setting): BusinessProfileSetting {
    return {
      businessName: settings.businessName,
      address: null,
      contactEmail: null,
      contactPhone: null,
      website: null,
      taxId: null,
    };
  }

  private defaultInvoiceTemplate(settings: Setting): InvoiceTemplateSetting {
    return {
      headerText: null,
      footerText: settings.footerNote,
      logoUrl: settings.logoUrl,
      invoicePrefix: 'INV',
      nextNumber: 1,
    };
  }

  private defaultTaxSettings(settings: Setting): TaxRateSetting[] {
    return [
      {
        branchId: null,
        taxName: 'VAT',
        taxRate: settings.taxRate ?? 0,
        isInclusive: false,
      },
    ];
  }

  private defaultStockPolicy(): StockPolicySetting {
    return {
      defaultLowStockThreshold: 0,
      allowStockTransfers: true,
      allowNegativeStock: false,
      autoReorderEnabled: false,
    };
  }

  private normalizeNullableString(
    value: string | null | undefined,
    fallback: string | null,
  ): string | null {
    if (value === undefined) {
      return fallback;
    }
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeRequiredString(
    value: string | null | undefined,
    fallback: string,
  ): string {
    if (value === undefined || value === null) {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  private normalizeRate(value: number | undefined): number {
    if (value === undefined) {
      return 0;
    }

    const numericValue = Number(value);
    if (Number.isNaN(numericValue) || numericValue < 0 || numericValue > 1) {
      throw new BadRequestException('Tax rate must be a decimal between 0 and 1.');
    }
    return numericValue;
  }

  private parseDateOrFail(input: string, label: string): Date {
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${label} date.`);
    }
    return parsed;
  }
}
