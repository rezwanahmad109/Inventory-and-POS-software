import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Purchase } from './purchase.entity';

@Entity({ name: 'suppliers' })
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  name!: string;

  @Column({ name: 'contact_name', length: 160, nullable: true })
  contactName!: string | null;

  @Column({ length: 40, nullable: true })
  phone!: string | null;

  @Column({ length: 160, nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @OneToMany(() => Purchase, (purchase) => purchase.supplier)
  purchases!: Purchase[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
