import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Role } from './role.entity';
import { UserRole } from './user-role.entity';

@Entity({ name: 'users' })
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  email!: string;

  // Stores bcrypt hash, never raw password.
  @Column({ name: 'password', select: false })
  password!: string;

  @Column({
    name: 'refresh_token_hash',
    type: 'text',
    nullable: true,
    select: false,
  })
  refreshTokenHash!: string | null;

  @Column({ name: 'refresh_token_issued_at', type: 'timestamptz', nullable: true })
  refreshTokenIssuedAt!: Date | null;

  @Column({ length: 160 })
  name!: string;

  @Column({ default: true })
  isActive!: boolean;

  // DEPRECATED: Old single-role system. Use userRoles relation instead.
  // Kept for backward compatibility during migration period.
  @ManyToOne(() => Role, {
    nullable: true,
    eager: false,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'role_id' })
  role!: Role | null;

  @Column({ name: 'role_id', nullable: true })
  roleId!: string | null;

  // New many-to-many role system
  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles!: UserRole[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
