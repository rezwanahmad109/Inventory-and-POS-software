import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'period_locks' })
export class PeriodLock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_period_locks_start_date')
  @Column({ name: 'start_date', type: 'date' })
  startDate!: Date;

  @Index('idx_period_locks_end_date')
  @Column({ name: 'end_date', type: 'date' })
  endDate!: Date;

  @Column({ name: 'is_locked', type: 'boolean', default: true })
  isLocked!: boolean;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}