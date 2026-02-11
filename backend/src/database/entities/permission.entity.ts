import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { RolePermission } from './role-permission.entity';

@Entity({ name: 'permissions' })
@Unique(['slug'])
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50 })
  module!: string;

  @Column({ length: 50 })
  action!: string;

  @Column({ length: 100 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.permission)
  rolePermissions!: RolePermission[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
