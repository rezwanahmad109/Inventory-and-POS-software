import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';

import { Unit } from '../entities/product.entity';

interface UnitSeedDefinition {
  name: string;
  symbol: string;
  conversionFactor: number;
  description: string;
}

const DEFAULT_UNITS: UnitSeedDefinition[] = [
  {
    name: 'Piece',
    symbol: 'pc',
    conversionFactor: 1,
    description: 'Single piece unit',
  },
  {
    name: 'Kilogram',
    symbol: 'kg',
    conversionFactor: 1,
    description: 'Weight unit in kilograms',
  },
  {
    name: 'Liter',
    symbol: 'l',
    conversionFactor: 1,
    description: 'Volume unit in liters',
  },
  {
    name: 'Box',
    symbol: 'box',
    conversionFactor: 1,
    description: 'Box pack unit',
  },
];

export async function runUnitSeed(unitsRepository: Repository<Unit>): Promise<void> {
  const logger = new Logger('UnitSeed');

  for (const definition of DEFAULT_UNITS) {
    const existing = await unitsRepository
      .createQueryBuilder('unit')
      .where('LOWER(unit.name) = :name', { name: definition.name.toLowerCase() })
      .getOne();

    if (existing) {
      existing.symbol = definition.symbol;
      existing.conversionFactor = definition.conversionFactor;
      existing.description = definition.description;
      await unitsRepository.save(existing);
      continue;
    }

    await unitsRepository.save(
      unitsRepository.create({
        name: definition.name,
        symbol: definition.symbol,
        conversionFactor: definition.conversionFactor,
        description: definition.description,
      }),
    );
    logger.log(`Seeded unit "${definition.name}".`);
  }
}
