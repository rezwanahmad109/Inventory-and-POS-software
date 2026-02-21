import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { decimalTransformer } from '../../common/transformers/decimal.transformer';
import { Sale } from './sale.entity';
import { User } from './user.entity';
import { SaleDeliveryItem } from './sale-delivery-item.entity';

@Entity({ name: 'sale_deliveries' })
@Unique(['deliveryNumber'])
export class SaleDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_sale_deliveries_delivery_number')
  @Column({ name: 'delivery_number', length: 40 })
  deliveryNumber!: string;

  @Column({ name: 'order_sale_id', type: 'uuid' })
  orderSaleId!: string;

  @ManyToOne(() => Sale, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_sale_id' })
  orderSale!: Sale;

  @Column({
    name: 'total_cogs',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  totalCogs!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy!: User | null;

  @OneToMany(() => SaleDeliveryItem, (item) => item.delivery)
  items!: SaleDeliveryItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
