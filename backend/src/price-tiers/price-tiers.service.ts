import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PriceTierEntity } from '../database/entities/price-tier.entity';
import { ProductPriceTierEntity } from '../database/entities/product-price-tier.entity';
import { Product } from '../database/entities/product.entity';
import { CreatePriceTierDto } from './dto/create-price-tier.dto';
import { SetProductTierPriceDto } from './dto/set-product-tier-price.dto';
import { UpdatePriceTierDto } from './dto/update-price-tier.dto';

@Injectable()
export class PriceTiersService {
  constructor(
    @InjectRepository(PriceTierEntity)
    private readonly priceTierRepository: Repository<PriceTierEntity>,
    @InjectRepository(ProductPriceTierEntity)
    private readonly productPriceTierRepository: Repository<ProductPriceTierEntity>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async create(dto: CreatePriceTierDto): Promise<PriceTierEntity> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.priceTierRepository.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Price tier code "${code}" already exists.`);
    }

    if (dto.isDefault) {
      await this.clearDefaultTier();
    }

    const tier = this.priceTierRepository.create({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
    });

    return this.priceTierRepository.save(tier);
  }

  async findAll(): Promise<PriceTierEntity[]> {
    return this.priceTierRepository.find({
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<PriceTierEntity> {
    const tier = await this.priceTierRepository.findOne({ where: { id } });
    if (!tier) {
      throw new NotFoundException(`Price tier "${id}" not found.`);
    }
    return tier;
  }

  async update(id: string, dto: UpdatePriceTierDto): Promise<PriceTierEntity> {
    const tier = await this.findOne(id);

    if (dto.code !== undefined) {
      const nextCode = dto.code.trim().toUpperCase();
      if (nextCode !== tier.code) {
        const duplicate = await this.priceTierRepository.findOne({
          where: { code: nextCode },
        });
        if (duplicate) {
          throw new ConflictException(
            `Price tier code "${nextCode}" already exists.`,
          );
        }
        tier.code = nextCode;
      }
    }

    if (dto.name !== undefined) {
      tier.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      tier.description = dto.description.trim() || null;
    }
    if (dto.isActive !== undefined) {
      tier.isActive = dto.isActive;
    }
    if (dto.isDefault !== undefined) {
      if (dto.isDefault) {
        await this.clearDefaultTier();
      }
      tier.isDefault = dto.isDefault;
    }

    return this.priceTierRepository.save(tier);
  }

  async remove(id: string): Promise<void> {
    const tier = await this.findOne(id);
    tier.isActive = false;
    tier.isDefault = false;
    await this.priceTierRepository.save(tier);
  }

  async setProductTierPrice(
    tierId: string,
    productId: string,
    dto: SetProductTierPriceDto,
  ): Promise<ProductPriceTierEntity> {
    const [tier, product] = await Promise.all([
      this.findOne(tierId),
      this.productsRepository.findOne({ where: { id: productId } }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product "${productId}" not found.`);
    }
    if (!tier.isActive) {
      throw new ConflictException('Cannot assign price to an inactive tier.');
    }

    let row = await this.productPriceTierRepository.findOne({
      where: {
        productId,
        priceTierId: tierId,
      },
      relations: { priceTier: true },
    });

    if (!row) {
      row = this.productPriceTierRepository.create({
        productId,
        priceTierId: tierId,
        price: Number(dto.price.toFixed(2)),
      });
    } else {
      row.price = Number(dto.price.toFixed(2));
    }

    return this.productPriceTierRepository.save(row);
  }

  async getTierProducts(tierId: string): Promise<ProductPriceTierEntity[]> {
    await this.findOne(tierId);
    return this.productPriceTierRepository.find({
      where: { priceTierId: tierId },
      relations: {
        priceTier: true,
        product: true,
      },
      order: {
        product: {
          name: 'ASC',
        },
      },
    });
  }

  private async clearDefaultTier(): Promise<void> {
    await this.priceTierRepository
      .createQueryBuilder()
      .update(PriceTierEntity)
      .set({ isDefault: false })
      .where('is_default = true')
      .execute();
  }
}
