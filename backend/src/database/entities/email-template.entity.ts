import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'email_templates' })
@Unique(['key'])
export class EmailTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 80 })
  key!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ name: 'subject_template', type: 'text' })
  subjectTemplate!: string;

  @Column({ name: 'body_template', type: 'text' })
  bodyTemplate!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
