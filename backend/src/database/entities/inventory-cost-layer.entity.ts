import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { BranchEntity } from './branch.entity';
import { Product } from './product.entity';

@Entity({ name: 'inventory_cost_layers' })
@Check('chk_inventory_cost_layers_quantities', '"original_quantity" > 0 AND "remaining_quantity" >= 0 AND "remaining_quantity" <= "original_quantity"')
export class InventoryCostLayer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_inventory_cost_layers_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Index('idx_inventory_cost_layers_warehouse_id')
  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => BranchEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: BranchEntity;

  @Column({ name: 'original_quantity', type: 'integer' })
  originalQuantity!: number;

  @Column({ name: 'remaining_quantity', type: 'integer' })
  remainingQuantity!: number;

  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 14,
    scale: 4,
    transformer: decimalTransformer,
  })
  unitCost!: number;

  @Column({ name: 'source_type', length: 40 })
  sourceType!: string;

  @Column({ name: 'source_id', length: 120 })
  sourceId!: string;

  @Column({ name: 'source_line_id', type: 'uuid', nullable: true })
  sourceLineId!: string | null;

  @Column({ name: 'parent_layer_id', type: 'uuid', nullable: true })
  parentLayerId!: string | null;

  @ManyToOne(() => InventoryCostLayer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_layer_id' })
  parentLayer!: InventoryCostLayer | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
