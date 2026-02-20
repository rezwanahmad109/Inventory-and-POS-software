import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';

import { EmailTemplateEntity } from '../database/entities/email-template.entity';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

interface RenderedEmail {
  subject: string;
  body: string;
}

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  order_confirmation: {
    subject: 'Order confirmation: {{invoiceNumber}}',
    body:
      'Hello {{customerName}},\nYour order {{invoiceNumber}} has been confirmed.\nTotal: {{grandTotal}}\nThank you.',
  },
  purchase_order: {
    subject: 'Purchase order {{invoiceNumber}}',
    body:
      'Hello {{supplierName}},\nPurchase order {{invoiceNumber}} has been issued.\nTotal: {{grandTotal}}',
  },
  receipt: {
    subject: 'Receipt {{invoiceNumber}}',
    body:
      'Hello {{customerName}},\nReceipt for {{invoiceNumber}}.\nPaid: {{paidTotal}}\nDue: {{dueTotal}}',
  },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly spoolDirectory = join(process.cwd(), 'exports', 'mail');

  constructor(
    @InjectRepository(EmailTemplateEntity)
    private readonly templatesRepository: Repository<EmailTemplateEntity>,
    private readonly configService: ConfigService,
  ) {}

  async createTemplate(
    dto: CreateEmailTemplateDto,
  ): Promise<EmailTemplateEntity> {
    const key = dto.key.trim().toLowerCase();
    const existing = await this.templatesRepository.findOne({ where: { key } });
    if (existing) {
      throw new ConflictException(`Email template "${key}" already exists.`);
    }

    const template = this.templatesRepository.create({
      key,
      name: dto.name.trim(),
      subjectTemplate: dto.subjectTemplate,
      bodyTemplate: dto.bodyTemplate,
      isActive: dto.isActive ?? true,
    });

    return this.templatesRepository.save(template);
  }

  async findTemplates(): Promise<EmailTemplateEntity[]> {
    return this.templatesRepository.find({
      order: { key: 'ASC' },
    });
  }

  async findTemplate(id: string): Promise<EmailTemplateEntity> {
    const template = await this.templatesRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Email template "${id}" not found.`);
    }
    return template;
  }

  async updateTemplate(
    id: string,
    dto: UpdateEmailTemplateDto,
  ): Promise<EmailTemplateEntity> {
    const template = await this.findTemplate(id);
    if (dto.key !== undefined) {
      const nextKey = dto.key.trim().toLowerCase();
      if (nextKey !== template.key) {
        const duplicate = await this.templatesRepository.findOne({
          where: { key: nextKey },
        });
        if (duplicate) {
          throw new ConflictException(`Email template "${nextKey}" already exists.`);
        }
        template.key = nextKey;
      }
    }
    if (dto.name !== undefined) {
      template.name = dto.name.trim();
    }
    if (dto.subjectTemplate !== undefined) {
      template.subjectTemplate = dto.subjectTemplate;
    }
    if (dto.bodyTemplate !== undefined) {
      template.bodyTemplate = dto.bodyTemplate;
    }
    if (dto.isActive !== undefined) {
      template.isActive = dto.isActive;
    }

    return this.templatesRepository.save(template);
  }

  async removeTemplate(id: string): Promise<void> {
    const template = await this.findTemplate(id);
    await this.templatesRepository.remove(template);
  }

  async sendNotification(dto: SendNotificationDto): Promise<{
    transport: string;
    from: string;
    templateKey: string;
    to: string;
    subject: string;
    body: string;
    queuedAt: string;
  }> {
    const rendered = await this.render(dto.templateKey, dto.context ?? {});
    return this.dispatchMail(dto.to, dto.templateKey, rendered);
  }

  async sendOrderConfirmation(
    to: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    await this.dispatchMail(
      to,
      'order_confirmation',
      await this.render('order_confirmation', context),
    );
  }

  async sendPurchaseOrder(
    to: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    await this.dispatchMail(
      to,
      'purchase_order',
      await this.render('purchase_order', context),
    );
  }

  async sendReceipt(to: string, context: Record<string, unknown>): Promise<void> {
    await this.dispatchMail(to, 'receipt', await this.render('receipt', context));
  }

  private async render(
    templateKey: string,
    context: Record<string, unknown>,
  ): Promise<RenderedEmail> {
    const key = templateKey.trim().toLowerCase();
    const template = await this.templatesRepository.findOne({ where: { key } });

    if (template && template.isActive) {
      return {
        subject: this.interpolate(template.subjectTemplate, context),
        body: this.interpolate(template.bodyTemplate, context),
      };
    }

    const fallback = DEFAULT_TEMPLATES[key];
    if (!fallback) {
      throw new NotFoundException(
        `Email template "${key}" not found and no default fallback exists.`,
      );
    }

    return {
      subject: this.interpolate(fallback.subject, context),
      body: this.interpolate(fallback.body, context),
    };
  }

  private async dispatchMail(
    to: string,
    templateKey: string,
    rendered: RenderedEmail,
  ): Promise<{
    transport: string;
    from: string;
    templateKey: string;
    to: string;
    subject: string;
    body: string;
    queuedAt: string;
  }> {
    const transport = this.configService.get<string>('MAIL_TRANSPORT', 'spool');
    const from = this.configService.get<string>(
      'EMAIL_FROM',
      'no-reply@inventory.local',
    );
    const queuedAt = new Date().toISOString();

    await mkdir(this.spoolDirectory, { recursive: true });
    const fileName = `${Date.now()}-${templateKey}-${Math.floor(
      Math.random() * 10_000,
    )}.json`;
    const filePath = join(this.spoolDirectory, fileName);
    const payload = {
      transport,
      from,
      templateKey,
      to,
      subject: rendered.subject,
      body: rendered.body,
      queuedAt,
    };

    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');

    this.logger.log(
      `Queued notification template=${templateKey} recipient=${to} from=${from} transport=${transport}`,
    );

    return payload;
  }

  private interpolate(
    template: string,
    context: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key) => {
      const value = this.resolveContextValue(context, key);
      return value === null || value === undefined ? '' : String(value);
    });
  }

  private resolveContextValue(
    context: Record<string, unknown>,
    path: string,
  ): unknown {
    const segments = path.split('.');
    let current: unknown = context;

    for (const segment of segments) {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        return '';
      }
      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }
}
