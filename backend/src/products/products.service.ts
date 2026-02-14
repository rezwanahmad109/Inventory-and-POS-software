import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';

import { StockAdjustmentReason } from '../common/enums/stock-adjustment-reason.enum';
import {
  StockLedgerReason,
  StockLedgerRefType,
} from '../common/enums/stock-ledger.enum';
import { AuditLog } from '../database/entities/audit-log.entity';
import { Category, Product, Unit } from '../database/entities/product.entity';
import { StockLedgerEntry } from '../database/entities/stock-ledger.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export type ProductView = Product & {
  stockValue: number;
  isLowStock: boolean;
};

export interface ProductFilters {
  categoryId?: string;
  unitId?: string;
}

export interface ProductSearchResult extends ProductView {
  matchRank: number;
  hotScore: number;
}

type HotProductCacheEntry = {
  score: number;
  lastTouchedAt: number;
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly hotProductCache = new Map<string, HotProductCacheEntry>();
  private readonly hotCacheMaxEntries = 300;

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
    @InjectRepository(StockLedgerEntry)
    private readonly stockLedgerRepository: Repository<StockLedgerEntry>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<ProductView> {
    const sku = createProductDto.sku.trim();
    const barcode = this.normalizeBarcode(createProductDto.barcode);
    const additionalBarcodes = this.normalizeAdditionalBarcodes(
      createProductDto.additionalBarcodes,
    );

    await this.ensureUniqueSku(sku);
    await this.ensureUniqueBarcode(barcode);
    await this.ensureUniqueAdditionalBarcodes(additionalBarcodes);

    const category = await this.getCategoryOrFail(createProductDto.categoryId);
    const unit = await this.getUnitOrFail(createProductDto.unitId);

    const product = this.productsRepository.create({
      sku,
      barcode,
      brand: createProductDto.brand?.trim() ?? null,
      additionalBarcodes,
      variationAttributes: this.normalizeVariationAttributes(
        createProductDto.variationAttributes,
      ),
      name: createProductDto.name.trim(),
      category,
      categoryId: category.id,
      unit,
      unitId: unit.id,
      price: createProductDto.price,
      taxRate: createProductDto.taxRate ?? null,
      taxMethod: createProductDto.taxMethod,
      stockQty: createProductDto.stockQty,
      lowStockThreshold: createProductDto.lowStockThreshold ?? 0,
      description: createProductDto.description?.trim() ?? null,
      image: createProductDto.image?.trim() ?? null,
    });

    const saved = await this.productsRepository.save(product);
    return this.findOne(saved.id);
  }

  async findAll(filters: ProductFilters = {}): Promise<ProductView[]> {
    const products = await this.buildProductQuery(filters)
      .orderBy('product.createdAt', 'DESC')
      .getMany();

    return products.map((product) => this.toProductView(product));
  }

  async findOne(id: string): Promise<ProductView> {
    const product = await this.findOneEntityOrFail(id);
    return this.toProductView(product);
  }

  async findByBarcode(barcode: string): Promise<ProductView> {
    const normalizedBarcode = barcode.trim();
    if (!normalizedBarcode) {
      throw new NotFoundException('Barcode is required.');
    }

    const product = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.unit', 'unit')
      .where('LOWER(product.barcode) = LOWER(:barcode)', {
        barcode: normalizedBarcode,
      })
      .orWhere(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(product.additional_barcodes, '[]'::jsonb)) AS extra_barcode
          WHERE LOWER(extra_barcode) = LOWER(:barcode)
        )`,
        { barcode: normalizedBarcode },
      )
      .getOne();

    if (!product) {
      throw new NotFoundException(`Product with barcode "${barcode}" not found.`);
    }

    this.markHotItem(product.id);
    return this.toProductView(product);
  }

  async search(query: string, limit = 20): Promise<ProductSearchResult[]> {
    const q = query.trim();
    if (!q) {
      const hotIds = [...this.hotProductCache.entries()]
        .sort(([, a], [, b]) => b.score - a.score)
        .slice(0, Math.min(limit, 25))
        .map(([id]) => id);

      if (hotIds.length === 0) {
        return [];
      }

      const hotProducts = await this.productsRepository.find({
        where: { id: In(hotIds) },
        relations: {
          category: true,
          unit: true,
        },
      });

      return hotProducts
        .map((product) => ({
          ...this.toProductView(product),
          matchRank: 0,
          hotScore: this.getHotScore(product.id),
        }))
        .sort((a, b) => b.hotScore - a.hotScore);
    }

    const safeLimit = Math.max(1, Math.min(limit, 50));
    const exact = q.toLowerCase();
    const prefix = `${exact}%`;
    const like = `%${exact}%`;

    const qb = this.buildProductQuery();
    qb
      .addSelect(
        `
        CASE
          WHEN LOWER(COALESCE(product.barcode, '')) = :exact THEN 120
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(product.additional_barcodes, '[]'::jsonb)) AS extra_barcode
            WHERE LOWER(extra_barcode) = :exact
          ) THEN 118
          WHEN LOWER(product.sku) = :exact THEN 110
          WHEN LOWER(product.sku) LIKE :prefix THEN 100
          WHEN LOWER(COALESCE(product.barcode, '')) LIKE :prefix THEN 95
          WHEN LOWER(product.name) LIKE :prefix THEN 85
          WHEN LOWER(product.name) LIKE :like THEN 75
          ELSE 60
        END
        `,
        'match_rank',
      )
      .where(
        `(
          LOWER(product.sku) LIKE :like
          OR LOWER(COALESCE(product.barcode, '')) LIKE :like
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(product.additional_barcodes, '[]'::jsonb)) AS extra_barcode
            WHERE LOWER(extra_barcode) LIKE :like
          )
          OR LOWER(product.name) LIKE :like
        )`,
        { like, prefix, exact },
      )
      .orderBy('match_rank', 'DESC')
      .addOrderBy('product.updatedAt', 'DESC')
      .limit(safeLimit);

    const { entities, raw } = await qb.getRawAndEntities();

    const rankedResults = entities.map((product, index) => {
      const rank = Number(raw[index]?.match_rank ?? 0);
      return {
        ...this.toProductView(product),
        matchRank: rank,
        hotScore: this.getHotScore(product.id),
      } satisfies ProductSearchResult;
    });

    rankedResults.sort((a, b) => {
      if (b.matchRank !== a.matchRank) {
        return b.matchRank - a.matchRank;
      }
      if (b.hotScore !== a.hotScore) {
        return b.hotScore - a.hotScore;
      }
      return a.name.localeCompare(b.name);
    });

    for (const result of rankedResults) {
      this.markHotItem(result.id);
    }

    return rankedResults;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductView> {
    const product = await this.findOneEntityOrFail(id);
    const previousStockQty = product.stockQty;

    if (updateProductDto.sku !== undefined) {
      const nextSku = updateProductDto.sku.trim();
      if (nextSku !== product.sku) {
        await this.ensureUniqueSku(nextSku, product.id);
      }
      product.sku = nextSku;
    }

    if (updateProductDto.barcode !== undefined) {
      const barcode = this.normalizeBarcode(updateProductDto.barcode);
      if (barcode !== product.barcode) {
        await this.ensureUniqueBarcode(barcode, product.id);
      }
      product.barcode = barcode;
    }

    if (updateProductDto.brand !== undefined) {
      product.brand = updateProductDto.brand.trim() || null;
    }

    if (updateProductDto.additionalBarcodes !== undefined) {
      const additionalBarcodes = this.normalizeAdditionalBarcodes(
        updateProductDto.additionalBarcodes,
      );
      await this.ensureUniqueAdditionalBarcodes(additionalBarcodes, product.id);
      product.additionalBarcodes = additionalBarcodes;
    }

    if (updateProductDto.variationAttributes !== undefined) {
      product.variationAttributes = this.normalizeVariationAttributes(
        updateProductDto.variationAttributes,
      );
    }

    if (updateProductDto.categoryId !== undefined) {
      const category = await this.getCategoryOrFail(updateProductDto.categoryId);
      product.category = category;
      product.categoryId = category.id;
    }

    if (updateProductDto.unitId !== undefined) {
      const unit = await this.getUnitOrFail(updateProductDto.unitId);
      product.unit = unit;
      product.unitId = unit.id;
    }

    if (updateProductDto.name !== undefined) {
      product.name = updateProductDto.name.trim();
    }

    if (updateProductDto.price !== undefined) {
      product.price = updateProductDto.price;
    }

    if (updateProductDto.taxRate !== undefined) {
      product.taxRate = updateProductDto.taxRate;
    }

    if (updateProductDto.taxMethod !== undefined) {
      product.taxMethod = updateProductDto.taxMethod;
    }

    if (updateProductDto.stockQty !== undefined) {
      product.stockQty = updateProductDto.stockQty;
    }

    if (updateProductDto.lowStockThreshold !== undefined) {
      product.lowStockThreshold = updateProductDto.lowStockThreshold;
    }

    if (updateProductDto.description !== undefined) {
      product.description = updateProductDto.description.trim() || null;
    }

    if (updateProductDto.image !== undefined) {
      product.image = updateProductDto.image.trim() || null;
    }

    const saved = await this.productsRepository.save(product);
    this.handleStockLevelChange(saved, previousStockQty, 'manual_update');
    return this.toProductView(saved);
  }

  async remove(id: string): Promise<void> {
    await this.findOneEntityOrFail(id);
    await this.productsRepository.softDelete(id);
  }

  async findLowStockProducts(): Promise<ProductView[]> {
    const products = await this.buildProductQuery()
      .where('product.lowStockThreshold > 0')
      .andWhere('product.stockQty <= product.lowStockThreshold')
      .orderBy('product.stockQty', 'ASC')
      .addOrderBy('product.createdAt', 'DESC')
      .getMany();

    return products.map((product) => this.toProductView(product));
  }

  async exportCsv(filters: ProductFilters = {}): Promise<string> {
    const products = await this.findAll(filters);
    const rows = [
      [
        'id',
        'name',
        'sku',
        'barcode',
        'additionalBarcodes',
        'brand',
        'categoryId',
        'unitId',
        'price',
        'taxRate',
        'taxMethod',
        'stockQty',
        'lowStockThreshold',
        'variationAttributes',
        'description',
      ],
      ...products.map((product) => [
        product.id,
        product.name,
        product.sku,
        product.barcode ?? '',
        (product.additionalBarcodes ?? []).join('|'),
        product.brand ?? '',
        product.categoryId,
        product.unitId,
        String(product.price),
        product.taxRate === null ? '' : String(product.taxRate),
        product.taxMethod,
        String(product.stockQty),
        String(product.lowStockThreshold ?? 0),
        JSON.stringify(product.variationAttributes ?? {}),
        product.description ?? '',
      ]),
    ];

    return rows
      .map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(','))
      .join('\n');
  }

  async importCsv(
    csvContent: string,
  ): Promise<{ imported: number; failed: number; errors: string[] }> {
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV must contain a header and at least one data row.');
    }

    const headers = this.parseCsvLine(lines[0]).map((header) => header.trim());
    const requiredHeaders = ['name', 'sku', 'categoryId', 'unitId', 'price', 'stockQty'];
    for (const requiredHeader of requiredHeaders) {
      if (!headers.includes(requiredHeader)) {
        throw new BadRequestException(`CSV is missing required column "${requiredHeader}".`);
      }
    }

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let index = 1; index < lines.length; index += 1) {
      const row = this.parseCsvLine(lines[index]);
      const rowObject = new Map<string, string>();
      headers.forEach((header, headerIndex) => {
        rowObject.set(header, row[headerIndex] ?? '');
      });

      try {
        await this.create({
          name: rowObject.get('name') ?? '',
          sku: rowObject.get('sku') ?? '',
          barcode: rowObject.get('barcode') || undefined,
          additionalBarcodes: (rowObject.get('additionalBarcodes') ?? '')
            .split('|')
            .map((barcode) => barcode.trim())
            .filter((barcode) => barcode.length > 0),
          brand: rowObject.get('brand') || undefined,
          categoryId: rowObject.get('categoryId') ?? '',
          unitId: rowObject.get('unitId') ?? '',
          price: Number(rowObject.get('price') ?? 0),
          taxRate:
            rowObject.get('taxRate') && rowObject.get('taxRate') !== ''
              ? Number(rowObject.get('taxRate'))
              : undefined,
          taxMethod: (rowObject.get('taxMethod') as any) || undefined,
          stockQty: Number(rowObject.get('stockQty') ?? 0),
          lowStockThreshold: Number(rowObject.get('lowStockThreshold') ?? 0),
          variationAttributes: this.safeParseJsonObject(
            rowObject.get('variationAttributes'),
          ),
          description: rowObject.get('description') || undefined,
          image: rowObject.get('image') || undefined,
        });
        imported += 1;
      } catch (error) {
        failed += 1;
        errors.push(
          `Row ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return { imported, failed, errors };
  }

  async adjustStock(
    productId: string,
    dto: StockAdjustmentDto,
    actorId: string | null,
  ): Promise<ProductView> {
    if (dto.qtyDelta === 0) {
      throw new BadRequestException('qtyDelta must not be zero.');
    }

    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new NotFoundException(`Product "${productId}" not found.`);
      }

      const previousStockQty = product.stockQty;
      const nextStockQty = previousStockQty + dto.qtyDelta;
      if (nextStockQty < 0) {
        throw new BadRequestException(
          `Stock adjustment would make stock negative for "${product.name}".`,
        );
      }

      product.stockQty = nextStockQty;
      await manager.save(Product, product);
      this.handleStockLevelChange(product, previousStockQty, 'manual_adjustment');

      await manager.save(
        StockLedgerEntry,
        manager.create(StockLedgerEntry, {
          productId: product.id,
          branchId: dto.branchId ?? null,
          qtyDelta: dto.qtyDelta,
          reason: StockLedgerReason.MANUAL_ADJUSTMENT,
          refType: StockLedgerRefType.PRODUCT,
          refId: product.id,
          createdBy: actorId,
        }),
      );

      await manager.save(
        AuditLog,
        manager.create(AuditLog, {
          actorId,
          action: `inventory.adjust.${dto.reason}`,
          entity: 'products',
          entityId: product.id,
          before: {
            stockQty: previousStockQty,
          },
          after: {
            stockQty: product.stockQty,
            reason: dto.reason,
            note: dto.note?.trim() ?? null,
          },
          requestId: null,
          correlationId: null,
        }),
      );

      const reloaded = await manager.findOne(Product, {
        where: { id: product.id },
        relations: { category: true, unit: true },
      });
      if (!reloaded) {
        throw new NotFoundException(`Product "${product.id}" not found.`);
      }
      return this.toProductView(reloaded);
    });
  }

  markHotItem(productId: string): void {
    const current = this.hotProductCache.get(productId);
    const now = Date.now();

    this.hotProductCache.set(productId, {
      score: (current?.score ?? 0) + 1,
      lastTouchedAt: now,
    });

    if (this.hotProductCache.size <= this.hotCacheMaxEntries) {
      return;
    }

    const sortedByOldest = [...this.hotProductCache.entries()].sort(
      ([, a], [, b]) => a.lastTouchedAt - b.lastTouchedAt,
    );

    while (sortedByOldest.length > 0 && this.hotProductCache.size > this.hotCacheMaxEntries) {
      const [oldestKey] = sortedByOldest.shift()!;
      this.hotProductCache.delete(oldestKey);
    }
  }

  convertQuantity(quantity: number, fromUnit: Unit, toUnit: Unit): number {
    const fromFactor = Number(fromUnit.conversionFactor || 1);
    const toFactor = Number(toUnit.conversionFactor || 1);
    const baseQuantity = quantity * fromFactor;
    return Number((baseQuantity / toFactor).toFixed(4));
  }

  handleStockLevelChange(
    product: Product,
    previousStockQty: number,
    source: string,
  ): void {
    const threshold = product.lowStockThreshold ?? 0;
    if (threshold <= 0) {
      return;
    }

    const crossedBelowThreshold =
      previousStockQty > threshold && product.stockQty <= threshold;
    if (!crossedBelowThreshold) {
      return;
    }

    this.logger.warn(
      `LOW_STOCK_ALERT source=${source} productId=${product.id} sku=${product.sku} stockQty=${product.stockQty} threshold=${threshold}`,
    );
  }

  private getHotScore(productId: string): number {
    return this.hotProductCache.get(productId)?.score ?? 0;
  }

  private normalizeBarcode(barcode?: string): string | null {
    if (barcode === undefined) {
      return null;
    }

    const trimmed = barcode.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeAdditionalBarcodes(
    additionalBarcodes?: string[],
  ): string[] | null {
    if (!additionalBarcodes || additionalBarcodes.length === 0) {
      return null;
    }

    const normalized = Array.from(
      new Set(
        additionalBarcodes
          .map((barcode) => barcode.trim())
          .filter((barcode) => barcode.length > 0),
      ),
    );
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeVariationAttributes(
    variationAttributes?: Record<string, string>,
  ): Record<string, string> | null {
    if (!variationAttributes) {
      return null;
    }

    const normalizedEntries = Object.entries(variationAttributes)
      .map(([key, value]) => [key.trim(), String(value).trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0);

    if (normalizedEntries.length === 0) {
      return null;
    }

    return Object.fromEntries(normalizedEntries);
  }

  private async findOneEntityOrFail(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: { category: true, unit: true },
    });

    if (!product) {
      throw new NotFoundException(`Product "${id}" not found.`);
    }

    return product;
  }

  private buildProductQuery(filters: ProductFilters = {}): SelectQueryBuilder<Product> {
    const query = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.unit', 'unit');

    if (filters.categoryId) {
      query.andWhere('product.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    if (filters.unitId) {
      query.andWhere('product.unitId = :unitId', {
        unitId: filters.unitId,
      });
    }

    return query;
  }

  private toProductView(product: Product): ProductView {
    const unitPrice = Number(product.price || 0);
    const stockValue = Number((product.stockQty * unitPrice).toFixed(2));
    const threshold = product.lowStockThreshold ?? 0;

    return {
      ...product,
      stockValue,
      isLowStock: threshold > 0 && product.stockQty <= threshold,
    };
  }

  private async getCategoryOrFail(categoryId: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category "${categoryId}" not found.`);
    }
    return category;
  }

  private async getUnitOrFail(unitId: string): Promise<Unit> {
    const unit = await this.unitsRepository.findOne({
      where: { id: unitId },
    });
    if (!unit) {
      throw new NotFoundException(`Unit "${unitId}" not found.`);
    }
    return unit;
  }

  private async ensureUniqueSku(sku: string, ignoreProductId?: string): Promise<void> {
    const query = this.productsRepository
      .createQueryBuilder('product')
      .withDeleted()
      .where('LOWER(product.sku) = LOWER(:sku)', { sku });

    if (ignoreProductId) {
      query.andWhere('product.id <> :ignoreProductId', { ignoreProductId });
    }

    const duplicate = await query.getOne();
    if (!duplicate) {
      return;
    }

    throw new ConflictException(`SKU "${sku}" already exists.`);
  }

  private async ensureUniqueBarcode(
    barcode: string | null,
    ignoreProductId?: string,
  ): Promise<void> {
    if (!barcode) {
      return;
    }

    const query = this.productsRepository
      .createQueryBuilder('product')
      .withDeleted()
      .where('LOWER(product.barcode) = LOWER(:barcode)', { barcode });

    if (ignoreProductId) {
      query.andWhere('product.id <> :ignoreProductId', { ignoreProductId });
    }

    const duplicate = await query.getOne();
    if (!duplicate) {
      return;
    }

    throw new ConflictException(`Barcode "${barcode}" already exists.`);
  }

  private async ensureUniqueAdditionalBarcodes(
    additionalBarcodes: string[] | null,
    ignoreProductId?: string,
  ): Promise<void> {
    if (!additionalBarcodes || additionalBarcodes.length === 0) {
      return;
    }

    for (const barcode of additionalBarcodes) {
      await this.ensureUniqueBarcode(barcode, ignoreProductId);
      const duplicate = await this.productsRepository
        .createQueryBuilder('product')
        .withDeleted()
        .where(
          `EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(product.additional_barcodes, '[]'::jsonb)) AS extra_barcode
            WHERE LOWER(extra_barcode) = LOWER(:barcode)
          )`,
          { barcode },
        )
        .andWhere(ignoreProductId ? 'product.id <> :ignoreProductId' : '1=1', {
          ignoreProductId,
        })
        .getOne();

      if (duplicate) {
        throw new ConflictException(`Barcode "${barcode}" already exists.`);
      }
    }
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '\"') {
        const nextChar = line[index + 1];
        if (insideQuotes && nextChar === '\"') {
          current += '\"';
          index += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
        continue;
      }

      if (char === ',' && !insideQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }

  private escapeCsvCell(value: string): string {
    if (value.includes(',') || value.includes('\"') || value.includes('\n')) {
      return `\"${value.replace(/\"/g, '\"\"')}\"`;
    }
    return value;
  }

  private safeParseJsonObject(input?: string): Record<string, string> | undefined {
    if (!input || !input.trim()) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(input);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return undefined;
      }

      return Object.entries(parsed).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: String(value),
        }),
        {} as Record<string, string>,
      );
    } catch {
      return undefined;
    }
  }
}
