import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';

import { TaxEntity } from '../entities/tax.entity';

interface TaxSeedDefinition {
  name: string;
  rate: number;
  isInclusive: boolean;
  isDefault: boolean;
  isActive: boolean;
}

const DEFAULT_TAXES: TaxSeedDefinition[] = [
  {
    name: 'VAT 0%',
    rate: 0,
    isInclusive: false,
    isDefault: true,
    isActive: true,
  },
  {
    name: 'VAT 5%',
    rate: 0.05,
    isInclusive: false,
    isDefault: false,
    isActive: true,
  },
  {
    name: 'VAT 15%',
    rate: 0.15,
    isInclusive: false,
    isDefault: false,
    isActive: true,
  },
];

export async function runTaxSeed(taxRepository: Repository<TaxEntity>): Promise<void> {
  const logger = new Logger('TaxSeed');
  let defaultAssigned = false;

  for (const definition of DEFAULT_TAXES) {
    const existing = await taxRepository
      .createQueryBuilder('tax')
      .where('LOWER(tax.name) = :name', { name: definition.name.toLowerCase() })
      .getOne();

    const isDefault = definition.isDefault && !defaultAssigned;
    if (isDefault) {
      defaultAssigned = true;
    }

    if (existing) {
      existing.rate = definition.rate;
      existing.isInclusive = definition.isInclusive;
      existing.isDefault = isDefault;
      existing.isActive = definition.isActive;
      await taxRepository.save(existing);
      continue;
    }

    await taxRepository.save(
      taxRepository.create({
        name: definition.name,
        rate: definition.rate,
        isInclusive: definition.isInclusive,
        isDefault,
        isActive: definition.isActive,
      }),
    );
    logger.log(`Seeded tax "${definition.name}".`);
  }

  if (!defaultAssigned) {
    const firstTax = await taxRepository.findOne({ where: {}, order: { createdAt: 'ASC' } });
    if (firstTax && !firstTax.isDefault) {
      firstTax.isDefault = true;
      await taxRepository.save(firstTax);
    }
  }
}
