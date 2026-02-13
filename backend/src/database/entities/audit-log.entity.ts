import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Index('idx_audit_logs_action')
  @Column({ length: 120 })
  action!: string;

  @Index('idx_audit_logs_entity')
  @Column({ length: 120 })
  entity!: string;

  @Column({ name: 'entity_id', length: 120 })
  entityId!: string;

  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  @Index('idx_audit_logs_request_id')
  @Column({ name: 'request_id', length: 120, nullable: true })
  requestId!: string | null;

  @Column({ name: 'correlation_id', length: 120, nullable: true })
  correlationId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
