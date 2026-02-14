import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { PriceTierEntity } from './price-tier.entity';
import { Product } from './product.entity';

@Entity({ name: 'product_price_tiers' })
@Unique(['productId', 'priceTierId'])
export class ProductPriceTierEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, (product) => product.productPriceTiers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id' })
  productId!: string;

  @ManyToOne(() => PriceTierEntity, (priceTier) => priceTier.productPrices, {
    nullable: false,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'price_tier_id' })
  priceTier!: PriceTierEntity;

  @Column({ name: 'price_tier_id' })
  priceTierId!: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  price!: number;
}
