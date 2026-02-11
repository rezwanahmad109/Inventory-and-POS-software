import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { Product, Unit } from '../database/entities/product.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async create(createUnitDto: CreateUnitDto): Promise<Unit> {
    const name = createUnitDto.name.trim();
    const symbol = createUnitDto.symbol.trim();
    await this.ensureUniqueUnit(name, symbol);

    const unit = this.unitsRepository.create({
      name,
      symbol,
      conversionFactor: createUnitDto.conversionFactor ?? 1,
      description: createUnitDto.description?.trim() ?? null,
    });

    return this.unitsRepository.save(unit);
  }

  async findAll(): Promise<Unit[]> {
    return this.unitsRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Unit> {
    const unit = await this.unitsRepository.findOne({
      where: { id },
    });
    if (!unit) {
      throw new NotFoundException(`Unit "${id}" not found.`);
    }
    return unit;
  }

  async update(id: string, updateUnitDto: UpdateUnitDto): Promise<Unit> {
    const unit = await this.findOne(id);
    const nextName = updateUnitDto.name?.trim() ?? unit.name;
    const nextSymbol = updateUnitDto.symbol?.trim() ?? unit.symbol;

    if (
      nextName.toLowerCase() !== unit.name.toLowerCase() ||
      nextSymbol.toLowerCase() !== unit.symbol.toLowerCase()
    ) {
      await this.ensureUniqueUnit(nextName, nextSymbol, unit.id);
    }

    unit.name = nextName;
    unit.symbol = nextSymbol;

    if (updateUnitDto.conversionFactor !== undefined) {
      unit.conversionFactor = updateUnitDto.conversionFactor;
    }
    if (updateUnitDto.description !== undefined) {
      unit.description = updateUnitDto.description.trim() || null;
    }

    return this.unitsRepository.save(unit);
  }

  async remove(id: string): Promise<void> {
    const unit = await this.findOne(id);

    const linkedProductCount = await this.productsRepository.count({
      where: { unitId: unit.id },
      withDeleted: true,
    });

    if (linkedProductCount > 0) {
      throw new BadRequestException(
        'Cannot delete unit because products are linked to it.',
      );
    }

    await this.unitsRepository.remove(unit);
  }

  async convertQuantity(
    quantity: number,
    fromUnitId: string,
    toUnitId: string,
  ): Promise<number> {
    if (quantity < 0) {
      throw new BadRequestException('Quantity must be greater than or equal to 0.');
    }

    const [fromUnit, toUnit] = await Promise.all([
      this.findOne(fromUnitId),
      this.findOne(toUnitId),
    ]);

    const fromFactor = Number(fromUnit.conversionFactor || 1);
    const toFactor = Number(toUnit.conversionFactor || 1);
    const baseQuantity = quantity * fromFactor;
    return Number((baseQuantity / toFactor).toFixed(4));
  }

  private async ensureUniqueUnit(
    name: string,
    symbol: string,
    ignoreId?: string,
  ): Promise<void> {
    const query = this.unitsRepository
      .createQueryBuilder('unit')
      .where(
        new Brackets((qb) => {
          qb.where('LOWER(unit.name) = LOWER(:name)', { name }).orWhere(
            'LOWER(unit.symbol) = LOWER(:symbol)',
            { symbol },
          );
        }),
      );

    if (ignoreId) {
      query.andWhere('unit.id <> :ignoreId', { ignoreId });
    }

    const duplicate = await query.getOne();
    if (!duplicate) {
      return;
    }

    throw new ConflictException(
      `Unit with name "${name}" or symbol "${symbol}" already exists.`,
    );
  }
}
