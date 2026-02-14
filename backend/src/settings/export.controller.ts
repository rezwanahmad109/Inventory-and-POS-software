import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ExportQueryDto } from './dto/settings-sections.dto';
import { ExportDataset, SettingsService } from './settings.service';

@Controller('export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('csv')
  @Permissions('reports.export')
  async exportCsv(@Query() query: ExportQueryDto, @Res() response: Response) {
    const dataset = (query.dataset ?? 'settings') as ExportDataset;
    const rows = await this.settingsService.buildExportDataset(dataset);
    const csv = this.toCsv(rows);

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${dataset}-${this.timestamp()}.csv"`,
    );
    response.status(200).send(csv);
  }

  @Get('pdf')
  @Permissions('reports.export')
  async exportPdf(@Query() query: ExportQueryDto, @Res() response: Response) {
    const dataset = (query.dataset ?? 'settings') as ExportDataset;
    const rows = await this.settingsService.buildExportDataset(dataset);
    const lines = [
      `Dataset: ${dataset}`,
      `Generated at: ${new Date().toISOString()}`,
      ...rows.slice(0, 60).map((row, index) => `${index + 1}. ${JSON.stringify(row)}`),
      ...(rows.length > 60 ? [`... ${rows.length - 60} more row(s)`] : []),
    ];

    const pdf = this.buildSimplePdf(lines);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${dataset}-${this.timestamp()}.pdf"`,
    );
    response.status(200).send(pdf);
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    if (rows.length === 0) {
      return '';
    }

    const headerSet = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((key) => headerSet.add(key));
    }

    const headers = Array.from(headerSet);
    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => this.escapeCsv(row[header])).join(','),
      ),
    ];

    return lines.join('\n');
  }

  private escapeCsv(value: unknown): string {
    if (value === null || value === undefined) {
      return '""';
    }

    const content =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    const escaped = content.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  private buildSimplePdf(lines: string[]): Buffer {
    const sanitizedLines = lines.map((line) =>
      line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'),
    );

    const textInstructions = sanitizedLines
      .map((line, index) => {
        const y = 800 - index * 12;
        return `1 0 0 1 40 ${y} Tm (${line}) Tj`;
      })
      .join('\n');

    const contentStream = `BT\n/F1 10 Tf\n${textInstructions}\nET`;
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += object;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }
}
