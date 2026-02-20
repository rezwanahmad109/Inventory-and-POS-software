import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';

import {
  CurrencySetting,
  EmailNotificationSetting,
  PaymentModeSetting,
  Setting,
  StockPolicySetting,
  TaxRateSetting,
} from '../entities/setting.entity';

const DEFAULT_CURRENCIES: CurrencySetting[] = [
  { code: 'USD', symbol: '$', position: 'left', isDefault: true },
  { code: 'EUR', symbol: 'EUR', position: 'left', isDefault: false },
];

const DEFAULT_PAYMENT_MODES: PaymentModeSetting[] = [
  { code: 'cash', name: 'Cash', isActive: true },
  { code: 'bank', name: 'Bank Transfer', isActive: true },
  { code: 'card', name: 'Card', isActive: true },
  { code: 'wallet', name: 'Wallet', isActive: true },
];

const DEFAULT_TAX_SETTINGS: TaxRateSetting[] = [
  { branchId: null, taxName: 'VAT', taxRate: 0, isInclusive: false },
];

const DEFAULT_STOCK_POLICY: StockPolicySetting = {
  defaultLowStockThreshold: 0,
  allowStockTransfers: true,
  allowNegativeStock: false,
  autoReorderEnabled: false,
};

const DEFAULT_EMAIL_SETTINGS: EmailNotificationSetting = {
  enabled: false,
  senderName: null,
  senderEmail: null,
  smtpHost: null,
  smtpPort: null,
  useTls: true,
};

export async function runSettingsSeed(
  settingsRepository: Repository<Setting>,
): Promise<void> {
  const logger = new Logger('SettingsSeed');

  let settings = await settingsRepository.findOne({ where: {} });
  if (!settings) {
    settings = settingsRepository.create({
      taxRate: 0,
      currency: 'USD',
      businessName: 'My Business',
      logoUrl: null,
      secondaryLogoUrl: null,
      footerNote: null,
      theme: 'default',
      timeZone: 'UTC',
      businessProfile: {
        businessName: 'My Business',
        address: null,
        contactEmail: null,
        contactPhone: null,
        website: null,
        taxId: null,
      },
      invoiceTemplate: {
        headerText: null,
        footerText: null,
        logoUrl: null,
        invoicePrefix: 'INV',
        nextNumber: 1,
      },
      taxSettings: DEFAULT_TAX_SETTINGS,
      discountRules: [],
      stockPolicy: DEFAULT_STOCK_POLICY,
      currencies: DEFAULT_CURRENCIES,
      paymentModes: DEFAULT_PAYMENT_MODES,
      emailNotificationSettings: DEFAULT_EMAIL_SETTINGS,
    });

    await settingsRepository.save(settings);
    logger.log('Seeded default settings row.');
    return;
  }

  let changed = false;
  if (!settings.currencies || settings.currencies.length === 0) {
    settings.currencies = DEFAULT_CURRENCIES;
    settings.currency = 'USD';
    changed = true;
  }

  if (!settings.paymentModes || settings.paymentModes.length === 0) {
    settings.paymentModes = DEFAULT_PAYMENT_MODES;
    changed = true;
  }

  if (!settings.taxSettings || settings.taxSettings.length === 0) {
    settings.taxSettings = DEFAULT_TAX_SETTINGS;
    changed = true;
  }

  if (!settings.stockPolicy) {
    settings.stockPolicy = DEFAULT_STOCK_POLICY;
    changed = true;
  }

  if (!settings.emailNotificationSettings) {
    settings.emailNotificationSettings = DEFAULT_EMAIL_SETTINGS;
    changed = true;
  }

  if (changed) {
    await settingsRepository.save(settings);
    logger.log('Backfilled missing settings reference sections.');
  }
}
