import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';

import { FileAttachmentEntity } from '../database/entities/file-attachment.entity';
import { Expense } from '../database/entities/expense.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { Sale } from '../database/entities/sale.entity';
import { LinkAttachmentDto } from './dto/link-attachment.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

@Injectable()
export class UploadsService {
  private readonly uploadRoot = join(process.cwd(), 'exports', 'uploads');
  private readonly signingSecret: string;

  constructor(
    @InjectRepository(FileAttachmentEntity)
    private readonly attachmentsRepository: Repository<FileAttachmentEntity>,
    @InjectRepository(Expense)
    private readonly expensesRepository: Repository<Expense>,
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(Purchase)
    private readonly purchasesRepository: Repository<Purchase>,
    configService: ConfigService,
  ) {
    this.signingSecret =
      configService.get<string>('FILE_SIGNING_SECRET') ??
      configService.get<string>('JWT_SECRET', 'dev-file-secret');
  }

  async uploadAttachment(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    uploadedBy: string | null,
    dto: UploadAttachmentDto,
  ): Promise<{
    attachment: FileAttachmentEntity;
    signedUrl: string;
    expiresAt: string;
  }> {
    if (!file) {
      throw new BadRequestException('file is required.');
    }

    const now = new Date();
    const folder = join(
      this.uploadRoot,
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
    );
    await mkdir(folder, { recursive: true });

    const extension = this.extractSafeExtension(file.originalname);
    const fileName = `${randomUUID()}${extension}`;
    const absolutePath = join(folder, fileName);
    await writeFile(absolutePath, file.buffer);

    const storageKey = absolutePath
      .slice(this.uploadRoot.length + 1)
      .replace(/\\/g, '/');

    const attachment = this.attachmentsRepository.create({
      storageProvider: 'local',
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: String(file.size),
      uploadedBy,
      resourceType: dto.resourceType?.trim() ?? null,
      resourceId: dto.resourceId?.trim() ?? null,
      meta: null,
    });

    const saved = await this.attachmentsRepository.save(attachment);

    if (dto.resourceType && dto.resourceId) {
      await this.linkAttachment(saved.id, {
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
      });
    }

    const signed = await this.createSignedUrl(saved.id, 3600);
    return {
      attachment: saved,
      signedUrl: signed.url,
      expiresAt: signed.expiresAt,
    };
  }

  async createSignedUrl(
    attachmentId: string,
    expiresInSeconds = 3600,
  ): Promise<{ url: string; expiresAt: string }> {
    await this.getAttachmentOrFail(attachmentId);
    const ttl = Math.min(Math.max(expiresInSeconds, 60), 86_400);
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const signature = this.sign(attachmentId, expires);

    return {
      url: `/uploads/download/${attachmentId}?expires=${expires}&signature=${signature}`,
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  }

  async resolveDownload(
    attachmentId: string,
    expires: string,
    signature: string,
  ): Promise<{ attachment: FileAttachmentEntity; absolutePath: string }> {
    const expiresAt = Number(expires);
    if (!Number.isFinite(expiresAt)) {
      throw new BadRequestException('Invalid signed URL expiry.');
    }

    const now = Math.floor(Date.now() / 1000);
    if (expiresAt < now) {
      throw new BadRequestException('Signed URL has expired.');
    }

    const expected = this.sign(attachmentId, expiresAt);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new BadRequestException('Invalid file signature.');
    }

    const attachment = await this.getAttachmentOrFail(attachmentId);
    const absolutePath = join(this.uploadRoot, attachment.storageKey);
    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException('Attachment file not found.');
    }

    return { attachment, absolutePath };
  }

  async linkAttachment(
    attachmentId: string,
    dto: LinkAttachmentDto,
  ): Promise<FileAttachmentEntity> {
    const attachment = await this.getAttachmentOrFail(attachmentId);
    const resourceType = dto.resourceType.trim().toLowerCase();
    const resourceId = dto.resourceId.trim();

    attachment.resourceType = resourceType;
    attachment.resourceId = resourceId;
    const saved = await this.attachmentsRepository.save(attachment);

    const attachmentToken = `attachment:${saved.id}`;
    if (resourceType === 'expense') {
      const expenseId = Number(resourceId);
      if (!Number.isInteger(expenseId)) {
        throw new BadRequestException('Expense resourceId must be numeric.');
      }

      const expense = await this.expensesRepository.findOne({ where: { id: expenseId } });
      if (!expense) {
        throw new NotFoundException(`Expense "${resourceId}" not found.`);
      }
      expense.attachments = this.appendAttachmentToken(expense.attachments, attachmentToken);
      await this.expensesRepository.save(expense);
      return saved;
    }

    if (resourceType === 'sale_invoice') {
      const sale = await this.salesRepository.findOne({ where: { id: resourceId } });
      if (!sale) {
        throw new NotFoundException(`Sale "${resourceId}" not found.`);
      }
      sale.attachments = this.appendAttachmentToken(sale.attachments, attachmentToken);
      await this.salesRepository.save(sale);
      return saved;
    }

    if (resourceType === 'purchase_invoice') {
      const purchase = await this.purchasesRepository.findOne({
        where: { id: resourceId },
      });
      if (!purchase) {
        throw new NotFoundException(`Purchase "${resourceId}" not found.`);
      }
      purchase.attachments = this.appendAttachmentToken(
        purchase.attachments,
        attachmentToken,
      );
      await this.purchasesRepository.save(purchase);
      return saved;
    }

    throw new BadRequestException(
      'Unsupported resourceType. Use expense, sale_invoice, or purchase_invoice.',
    );
  }

  async getAttachment(attachmentId: string): Promise<FileAttachmentEntity> {
    return this.getAttachmentOrFail(attachmentId);
  }

  private appendAttachmentToken(
    existing: string[] | null,
    token: string,
  ): string[] {
    const next = new Set(existing ?? []);
    next.add(token);
    return [...next];
  }

  private extractSafeExtension(fileName: string): string {
    const index = fileName.lastIndexOf('.');
    if (index < 0) {
      return '';
    }
    const ext = fileName.slice(index).trim().toLowerCase();
    if (!/^\.[a-z0-9]{1,10}$/.test(ext)) {
      return '';
    }
    return ext;
  }

  private sign(attachmentId: string, expires: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${attachmentId}:${expires}`)
      .digest('hex');
  }

  private async getAttachmentOrFail(
    attachmentId: string,
  ): Promise<FileAttachmentEntity> {
    const attachment = await this.attachmentsRepository.findOne({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment "${attachmentId}" not found.`);
    }
    return attachment;
  }
}
