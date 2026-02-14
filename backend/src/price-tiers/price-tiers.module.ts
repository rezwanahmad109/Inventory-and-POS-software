import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PriceTierEntity } from '../database/entities/price-tier.entity';
import { ProductPriceTierEntity } from '../database/entities/product-price-tier.entity';
import { Product } from '../database/entities/product.entity';
import { PriceTiersController } from './price-tiers.controller';
import { PriceTiersService } from './price-tiers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PriceTierEntity, ProductPriceTierEntity, Product]),
  ],
  controllers: [PriceTiersController],
  providers: [PriceTiersService],
  exports: [PriceTiersService],
})
export class PriceTiersModule {}
