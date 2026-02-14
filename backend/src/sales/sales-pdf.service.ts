import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Sale } from '../database/entities/sale.entity';
import { Setting } from '../database/entities/setting.entity';

@Injectable()
export class SalesPdfService {
  constructor(
    @InjectRepository(Sale)
    private readonly salesRepository: Repository<Sale>,
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) {}

  async generateInvoicePdf(saleId: string): Promise<{ sale: Sale; pdf: Buffer }> {
    const sale = await this.salesRepository.findOne({
      where: { id: saleId },
      relations: { items: true, payments: true },
    });
    if (!sale) {
      throw new NotFoundException(`Sale "${saleId}" not found.`);
    }

    const settings = await this.settingsRepository.findOne({ where: {} });
    const companyName = settings?.businessName ?? 'My Business';
    const logoUrl = settings?.logoUrl ?? 'N/A';

    const template = [
      'INVOICE {{invoiceNumber}}',
      'Company: {{companyName}}',
      'Logo: {{logoUrl}}',
      'Date: {{createdAt}}',
      'Customer: {{customer}}',
      'Status: {{status}}',
      '----------------------------------------',
      'Items:',
      '{{items}}',
      '----------------------------------------',
      'Subtotal: {{subtotal}}',
      'Tax: {{taxTotal}}',
      'Discount: {{discountTotal}}',
      'Shipping: {{shippingTotal}}',
      'Grand Total: {{grandTotal}}',
      'Paid: {{paidTotal}}',
      'Due: {{dueTotal}}',
      '----------------------------------------',
      'BARCODE: {{invoiceNumber}}',
      'QR: {{invoiceQrPayload}}',
    ].join('\n');

    const itemsText =
      sale.items.length === 0
        ? '-'
        : sale.items
            .map(
              (item) =>
                `- ${item.product?.name ?? item.productId} x ${item.quantity} @ ${item.unitPrice} = ${item.lineTotal}`,
            )
            .join('\n');

    const rendered = this.renderTemplate(template, {
      invoiceNumber: sale.invoiceNumber,
      companyName,
      logoUrl,
      createdAt: sale.createdAt.toISOString(),
      customer: sale.customer ?? `Customer #${sale.customerId ?? 'N/A'}`,
      status: sale.status,
      items: itemsText,
      subtotal: sale.subtotal.toFixed(2),
      taxTotal: sale.taxTotal.toFixed(2),
      discountTotal: sale.discountTotal.toFixed(2),
      shippingTotal: sale.shippingTotal.toFixed(2),
      grandTotal: sale.grandTotal.toFixed(2),
      paidTotal: sale.paidTotal.toFixed(2),
      dueTotal: sale.dueTotal.toFixed(2),
      invoiceQrPayload: JSON.stringify({
        invoiceNumber: sale.invoiceNumber,
        saleId: sale.id,
        amount: sale.grandTotal,
      }),
    });

    return {
      sale,
      pdf: this.toSimplePdf(rendered),
    };
  }

  private renderTemplate(
    template: string,
    context: Record<string, string>,
  ): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
      return context[key] ?? '';
    });
  }

  private toSimplePdf(text: string): Buffer {
    const safeText = text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

    const content = `BT /F1 10 Tf 40 790 Td (${safeText.replace(/\n/g, ') Tj T* (')}) Tj ET`;

    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${object}\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let index = 1; index < offsets.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
  }
}
