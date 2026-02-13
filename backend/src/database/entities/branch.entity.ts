import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { BranchProductEntity } from './branch-product.entity';

@Entity({ name: 'branches' })
@Unique(['code'])
export class BranchEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 40 })
  code!: string;

  @Column({ length: 255, nullable: true })
  location!: string | null;

  @Column({ length: 40, nullable: true })
  phone!: string | null;

  @Column({ name: 'manager_name', length: 120, nullable: true })
  managerName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => BranchProductEntity, (branchProduct) => branchProduct.branch)
  branchProducts!: BranchProductEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
