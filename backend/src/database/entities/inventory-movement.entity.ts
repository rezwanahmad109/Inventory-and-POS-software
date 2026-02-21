import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { BranchEntity } from './branch.entity';
import { InventoryCostLayer } from './inventory-cost-layer.entity';
import { Product } from './product.entity';

export enum InventoryMovementDirection {
  IN = 'in',
  OUT = 'out',
}

@Entity({ name: 'inventory_movements' })
@Check('chk_inventory_movements_quantity', '"quantity" > 0')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_inventory_movements_product_id')
  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Index('idx_inventory_movements_warehouse_id')
  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => BranchEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: BranchEntity;

  @Column({
    type: 'enum',
    enum: InventoryMovementDirection,
  })
  direction!: InventoryMovementDirection;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({
    name: 'unit_cost',
    type: 'numeric',
    precision: 14,
    scale: 4,
    transformer: decimalTransformer,
  })
  unitCost!: number;

  @Column({
    name: 'total_cost',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalCost!: number;

  @Column({ name: 'reference_type', length: 40 })
  referenceType!: string;

  @Column({ name: 'reference_id', length: 120 })
  referenceId!: string;

  @Column({ name: 'reference_line_id', type: 'uuid', nullable: true })
  referenceLineId!: string | null;

  @Column({ name: 'source_cost_layer_id', type: 'uuid', nullable: true })
  sourceCostLayerId!: string | null;

  @ManyToOne(() => InventoryCostLayer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_cost_layer_id' })
  sourceCostLayer!: InventoryCostLayer | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
