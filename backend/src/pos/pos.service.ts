import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { DiscountType } from '../common/enums/discount-type.enum';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PosOrder } from '../database/entities/pos-order.entity';
import { Product } from '../database/entities/product.entity';
import { CreateSaleDto } from '../sales/dto/create-sale.dto';
import { SalesService } from '../sales/sales.service';
import { computePricing } from '../sales/pricing/pricing-engine';
import { ProductsService } from '../products/products.service';
import { CheckoutPosOrderDto } from './dto/checkout-pos-order.dto';
import { CreatePosOrderDto } from './dto/create-pos-order.dto';
import { PosSearchQueryDto } from './dto/pos-search-query.dto';
import { UpdatePosOrderDto } from './dto/update-pos-order.dto';

@Injectable()
export class PosService {
  constructor(
    @InjectRepository(PosOrder)
    private readonly posOrderRepository: Repository<PosOrder>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly productsService: ProductsService,
    private readonly salesService: SalesService,
    private readonly dataSource: DataSource,
  ) {}

  async searchProducts(query: PosSearchQueryDto) {
    return this.productsService.search(query.q?.trim() ?? '', query.limit ?? 20);
  }

  async createCart(dto: CreatePosOrderDto, user: RequestUser): Promise<PosOrder> {
    return this.dataSource.transaction(async (manager) => {
      const totals = await this.calculateOrderTotals(dto);

      const order = manager.create(PosOrder, {
        orderNumber: await this.generateOrderNumber(manager),
        status: 'cart',
        branchId: dto.branchId ?? null,
        customerName: dto.customer?.trim() ?? null,
        customerId: dto.customerId ?? null,
        items: dto.items,
        invoiceDiscountType: dto.invoiceDiscountType ?? DiscountType.NONE,
        invoiceDiscountValue: dto.invoiceDiscountValue ?? 0,
        invoiceTaxRate: dto.invoiceTaxRate ?? null,
        invoiceTaxMethod: dto.invoiceTaxMethod ?? null,
        shippingTotal: Number((dto.shippingTotal ?? 0).toFixed(2)),
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        invoiceId: null,
        note: dto.note?.trim() ?? null,
        createdByUserId: user.userId,
      });

      return manager.save(PosOrder, order);
    });
  }

  async updateCart(
    orderId: string,
    dto: UpdatePosOrderDto,
    user: RequestUser,
  ): Promise<PosOrder> {
    const order = await this.posOrderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`POS order "${orderId}" not found.`);
    }

    if (order.status === 'completed') {
      throw new BadRequestException('Completed POS orders cannot be updated.');
    }

    const nextPayload: CreatePosOrderDto = {
      branchId: dto.branchId ?? order.branchId ?? undefined,
      customer: dto.customer ?? order.customerName ?? undefined,
      customerId: dto.customerId ?? order.customerId ?? undefined,
      items: dto.items ?? order.items,
      invoiceDiscountType: dto.invoiceDiscountType ?? order.invoiceDiscountType,
      invoiceDiscountValue: dto.invoiceDiscountValue ?? order.invoiceDiscountValue,
      invoiceTaxRate:
        dto.invoiceTaxRate !== undefined ? dto.invoiceTaxRate : order.invoiceTaxRate ?? undefined,
      invoiceTaxMethod:
        dto.invoiceTaxMethod !== undefined ? dto.invoiceTaxMethod : order.invoiceTaxMethod ?? undefined,
      shippingTotal: dto.shippingTotal ?? order.shippingTotal,
      note: dto.note ?? order.note ?? undefined,
    };

    const totals = await this.calculateOrderTotals(nextPayload);

    order.branchId = nextPayload.branchId ?? null;
    order.customerName = nextPayload.customer?.trim() ?? null;
    order.customerId = nextPayload.customerId ?? null;
    order.items = nextPayload.items;
    order.invoiceDiscountType = nextPayload.invoiceDiscountType ?? DiscountType.NONE;
    order.invoiceDiscountValue = nextPayload.invoiceDiscountValue ?? 0;
    order.invoiceTaxRate = nextPayload.invoiceTaxRate ?? null;
    order.invoiceTaxMethod = nextPayload.invoiceTaxMethod ?? null;
    order.shippingTotal = Number((nextPayload.shippingTotal ?? 0).toFixed(2));
    order.subtotal = totals.subtotal;
    order.discountTotal = totals.discountTotal;
    order.taxTotal = totals.taxTotal;
    order.grandTotal = totals.grandTotal;
    order.note = nextPayload.note?.trim() ?? null;

    return this.posOrderRepository.save(order);
  }

  async holdOrder(orderId: string): Promise<PosOrder> {
    const order = await this.findOrderOrFail(orderId);
    if (order.status === 'completed') {
      throw new BadRequestException('Completed order cannot be held.');
    }

    order.status = 'held';
    return this.posOrderRepository.save(order);
  }

  async resumeOrder(orderId: string): Promise<PosOrder> {
    const order = await this.findOrderOrFail(orderId);
    if (order.status !== 'held') {
      throw new BadRequestException('Only held orders can be resumed.');
    }

    order.status = 'cart';
    return this.posOrderRepository.save(order);
  }

  async checkoutOrder(
    orderId: string,
    dto: CheckoutPosOrderDto,
    user: RequestUser,
  ) {
    const order = await this.findOrderOrFail(orderId);

    if (order.status === 'completed') {
      if (!order.invoiceId) {
        throw new BadRequestException('Order is completed but invoice reference is missing.');
      }

      return {
        order,
        sale: await this.salesService.findOne(order.invoiceId),
      };
    }

    const salePayload: CreateSaleDto = {
      branchId: order.branchId ?? undefined,
      customer: order.customerName ?? undefined,
      customerId: order.customerId ?? undefined,
      invoiceDiscountType: order.invoiceDiscountType,
      invoiceDiscountValue: order.invoiceDiscountValue,
      invoiceTaxOverride:
        order.invoiceTaxRate !== null && order.invoiceTaxMethod !== null
          ? { rate: order.invoiceTaxRate, method: order.invoiceTaxMethod }
          : undefined,
      items: order.items,
      payments: dto.payments ?? [],
      notes: order.note ?? undefined,
      shippingTotal: order.shippingTotal,
    };

    const sale = await this.salesService.createInvoice(salePayload, user);

    order.status = 'completed';
    order.invoiceId = sale.id;
    await this.posOrderRepository.save(order);

    return {
      order,
      sale,
    };
  }

  async getReceipt(orderId: string): Promise<Record<string, unknown>> {
    const order = await this.findOrderOrFail(orderId);

    const sale = order.invoiceId
      ? await this.salesService.findOne(order.invoiceId)
      : null;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customer: order.customerName,
      createdAt: order.createdAt,
      totals: {
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        taxTotal: order.taxTotal,
        shippingTotal: order.shippingTotal,
        grandTotal: order.grandTotal,
      },
      invoice: sale
        ? {
            id: sale.id,
            invoiceNumber: sale.invoiceNumber,
            status: sale.status,
            paidTotal: sale.paidTotal,
            dueTotal: sale.dueTotal,
            items: sale.items,
            payments: sale.payments,
          }
        : null,
    };
  }

  async listOrders(status?: 'cart' | 'held' | 'completed' | 'cancelled') {
    if (status) {
      return this.posOrderRepository.find({
        where: { status },
        order: { createdAt: 'DESC' },
      });
    }

    return this.posOrderRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  private async calculateOrderTotals(dto: CreatePosOrderDto): Promise<{
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
  }> {
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.productsRepository.find({
      where: { id: In(productIds) },
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    for (const item of dto.items) {
      if (!productById.has(item.productId)) {
        throw new NotFoundException(`Product "${item.productId}" not found.`);
      }
    }

    const pricing = computePricing({
      items: dto.items.map((item) => {
        const product = productById.get(item.productId)!;
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number((item.unitPriceOverride ?? Number(product.price)).toFixed(2)),
          lineDiscountType: item.lineDiscountType,
          lineDiscountValue: item.lineDiscountValue,
          taxRate: dto.invoiceTaxRate ?? Number(product.taxRate ?? 0),
          taxMethod: dto.invoiceTaxMethod ?? product.taxMethod,
        };
      }),
      invoiceDiscountType: dto.invoiceDiscountType,
      invoiceDiscountValue: dto.invoiceDiscountValue,
      invoiceTaxOverride:
        dto.invoiceTaxRate !== undefined && dto.invoiceTaxMethod !== undefined
          ? {
              rate: dto.invoiceTaxRate,
              method: dto.invoiceTaxMethod,
            }
          : null,
    });

    const shippingTotal = Number((dto.shippingTotal ?? 0).toFixed(2));

    return {
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      taxTotal: pricing.taxTotal,
      grandTotal: Number((pricing.grandTotal + shippingTotal).toFixed(2)),
    };
  }

  private async generateOrderNumber(manager: Repository<PosOrder>['manager']): Promise<string> {
    const count = await manager.count(PosOrder);
    return `POS-${String(count + 1).padStart(6, '0')}`;
  }

  private async findOrderOrFail(orderId: string): Promise<PosOrder> {
    const order = await this.posOrderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`POS order "${orderId}" not found.`);
    }
    return order;
  }
}
