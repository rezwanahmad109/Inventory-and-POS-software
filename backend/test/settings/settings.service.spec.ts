import { describe, expect, it, jest } from '@jest/globals';
import { Repository } from 'typeorm';

import { AuditLog } from '../../src/database/entities/audit-log.entity';
import { BranchProductEntity } from '../../src/database/entities/branch-product.entity';
import { Setting } from '../../src/database/entities/setting.entity';
import { SettingsService } from '../../src/settings/settings.service';

describe('SettingsService', () => {
  const baseSettings = (): Setting =>
    ({
      id: 1,
      taxRate: 0,
      currency: 'USD',
      logoUrl: null,
      secondaryLogoUrl: null,
      businessName: 'My Business',
      footerNote: null,
      theme: 'default',
      timeZone: 'UTC',
      businessProfile: null,
      invoiceTemplate: null,
      taxSettings: null,
      discountRules: null,
      stockPolicy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as Setting;

  const setupService = () => {
    const settingsRepository = {
      findOne: jest.fn(async () => baseSettings()),
      save: jest.fn(async (value: Setting) => value),
      create: jest.fn((value: Partial<Setting>) => value),
    } as unknown as Repository<Setting>;

    const auditLogsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => []),
      }),
    } as unknown as Repository<AuditLog>;

    const branchProductsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(async () => []),
      }),
    } as unknown as Repository<BranchProductEntity>;

    const service = new SettingsService(
      settingsRepository,
      auditLogsRepository,
      branchProductsRepository,
    );

    return { service, settingsRepository };
  };

  it('updates business profile and keeps legacy businessName in sync', async () => {
    const { service, settingsRepository } = setupService();

    const updated = await service.updateBusinessProfile({
      businessName: 'Rezwan Retail',
      address: 'Main Street',
    });

    expect(updated.businessName).toBe('Rezwan Retail');
    expect(updated.address).toBe('Main Street');

    const savedSettings = (settingsRepository.save as jest.Mock).mock
      .calls[0][0] as Setting;
    expect(savedSettings.businessName).toBe('Rezwan Retail');
  });

  it('updates tax settings and promotes first rate to legacy taxRate', async () => {
    const { service, settingsRepository } = setupService();

    const rates = await service.updateTaxSettings({
      rates: [{ taxName: 'VAT', taxRate: 0.07, isInclusive: false }],
    });

    expect(rates).toHaveLength(1);
    expect(rates[0].taxRate).toBe(0.07);

    const savedSettings = (settingsRepository.save as jest.Mock).mock
      .calls[0][0] as Setting;
    expect(savedSettings.taxRate).toBe(0.07);
  });

  it('rejects invalid audit-log date filters', async () => {
    const { service } = setupService();
    await expect(
      service.getAuditLogs({
        from: 'not-a-date',
        limit: 10,
      }),
    ).rejects.toThrow('Invalid from date.');
  });
});
