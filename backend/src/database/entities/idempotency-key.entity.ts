import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'idempotency_keys' })
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'scope', length: 80 })
  scope!: string;

  @Column({ name: 'idempotency_key', length: 120, unique: true })
  idempotencyKey!: string;

  @Column({ name: 'request_hash', length: 120 })
  requestHash!: string;

  @Column({ name: 'response_entity_id', length: 120, nullable: true })
  responseEntityId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
