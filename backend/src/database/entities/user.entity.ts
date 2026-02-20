import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({
    name: 'refresh_token_jti_hash',
    type: 'text',
    nullable: true,
    select: false,
  })
  refreshTokenJtiHash!: string | null;

  @Column({ name: 'refresh_token_issued_at', type: 'timestamptz', nullable: true })
  refreshTokenIssuedAt!: Date | null;

  @Column({ length: 160 })
  name!: string;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles!: UserRole[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
