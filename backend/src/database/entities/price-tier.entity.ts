import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ProductPriceTierEntity } from './product-price-tier.entity';

@Entity({ name: 'price_tiers' })
@Unique(['code'])
export class PriceTierEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 60 })
  code!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => ProductPriceTierEntity, (productTier) => productTier.priceTier)
  productPrices!: ProductPriceTierEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
