import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TaxEntity } from '../database/entities/tax.entity';
import { CreateTaxDto } from './dto/create-tax.dto';
import { UpdateTaxDto } from './dto/update-tax.dto';

@Injectable()
export class TaxesService {
  constructor(
    @InjectRepository(TaxEntity)
    private readonly taxesRepository: Repository<TaxEntity>,
  ) {}

  async create(dto: CreateTaxDto): Promise<TaxEntity> {
    const name = dto.name.trim();
    const existing = await this.taxesRepository
      .createQueryBuilder('tax')
      .where('LOWER(tax.name) = LOWER(:name)', { name })
      .getOne();
    if (existing) {
      throw new ConflictException(`Tax "${name}" already exists.`);
    }

    if (dto.isDefault) {
      await this.clearDefaultFlag();
    }

    const tax = this.taxesRepository.create({
      name,
      rate: Number(dto.rate.toFixed(4)),
      isInclusive: dto.isInclusive ?? false,
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
    });

    return this.taxesRepository.save(tax);
  }

  async findAll(): Promise<TaxEntity[]> {
    return this.taxesRepository.find({
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<TaxEntity> {
    const tax = await this.taxesRepository.findOne({ where: { id } });
    if (!tax) {
      throw new NotFoundException(`Tax "${id}" not found.`);
    }
    return tax;
  }

  async update(id: string, dto: UpdateTaxDto): Promise<TaxEntity> {
    const tax = await this.findOne(id);

    if (dto.name !== undefined) {
      const nextName = dto.name.trim();
      if (nextName.toLowerCase() !== tax.name.toLowerCase()) {
        const duplicate = await this.taxesRepository
          .createQueryBuilder('t')
          .where('LOWER(t.name) = LOWER(:name)', { name: nextName })
          .andWhere('t.id <> :id', { id })
          .getOne();
        if (duplicate) {
          throw new ConflictException(`Tax "${nextName}" already exists.`);
        }
      }
      tax.name = nextName;
    }

    if (dto.rate !== undefined) {
      tax.rate = Number(dto.rate.toFixed(4));
    }
    if (dto.isInclusive !== undefined) {
      tax.isInclusive = dto.isInclusive;
    }
    if (dto.isActive !== undefined) {
      tax.isActive = dto.isActive;
    }
    if (dto.isDefault !== undefined) {
      if (dto.isDefault) {
        await this.clearDefaultFlag();
      }
      tax.isDefault = dto.isDefault;
    }

    return this.taxesRepository.save(tax);
  }

  async remove(id: string): Promise<void> {
    const tax = await this.findOne(id);
    await this.taxesRepository.remove(tax);
  }

  private async clearDefaultFlag(): Promise<void> {
    await this.taxesRepository
      .createQueryBuilder()
      .update(TaxEntity)
      .set({ isDefault: false })
      .where('is_default = true')
      .execute();
  }
}
