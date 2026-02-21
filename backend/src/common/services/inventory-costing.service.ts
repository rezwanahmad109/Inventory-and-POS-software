import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';

import {
  InventoryCostLayer,
} from '../../database/entities/inventory-cost-layer.entity';
import {
  InventoryMovement,
  InventoryMovementDirection,
} from '../../database/entities/inventory-movement.entity';

interface LayerSnapshot {
  sourceLayerId: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface PurchaseLayerInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  sourceId: string;
  sourceLineId?: string | null;
}

interface ConsumeInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  referenceLineId?: string | null;
  actorId?: string | null;
}

interface RestoreSalesReturnInput {
  originalSaleId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  referenceId: string;
  referenceLineId?: string | null;
  actorId?: string | null;
}

interface ReceiveTransferInput {
  productId: string;
  warehouseId: string;
  sourceId: string;
  snapshots: Array<{
    sourceLayerId: string | null;
    quantity: number;
    unitCost: number;
  }>;
  actorId?: string | null;
}

@Injectable()
export class InventoryCostingService {
  constructor() {}

  async createPurchaseLayer(
    manager: EntityManager,
    input: PurchaseLayerInput,
  ): Promise<InventoryCostLayer> {
    if (input.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero.');
    }

    if (input.unitCost < 0) {
      throw new BadRequestException('Unit cost cannot be negative.');
    }

    const layer = manager.create(InventoryCostLayer, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      originalQuantity: input.quantity,
      remainingQuantity: input.quantity,
      unitCost: this.round4(input.unitCost),
      sourceType: 'purchase',
      sourceId: input.sourceId,
      sourceLineId: input.sourceLineId ?? null,
      parentLayerId: null,
    });

    const saved = await manager.save(InventoryCostLayer, layer);

    await this.recordMovement(manager, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      direction: InventoryMovementDirection.IN,
      quantity: input.quantity,
      unitCost: this.round4(input.unitCost),
      referenceType: 'purchase',
      referenceId: input.sourceId,
      referenceLineId: input.sourceLineId ?? null,
      sourceCostLayerId: saved.id,
      actorId: null,
    });

    return saved;
  }

  async consumeForSale(
    manager: EntityManager,
    input: ConsumeInput,
  ): Promise<{ totalCost: number; layers: LayerSnapshot[] }> {
    return this.consumeFromLayers(manager, {
      ...input,
      referenceType: 'sale_delivery',
    });
  }

  async consumeForTransfer(
    manager: EntityManager,
    input: ConsumeInput,
  ): Promise<{ totalCost: number; layers: LayerSnapshot[] }> {
    return this.consumeFromLayers(manager, {
      ...input,
      referenceType: 'stock_transfer_out',
    });
  }

  async consumeForPurchaseReturn(
    manager: EntityManager,
    input: ConsumeInput,
  ): Promise<{ totalCost: number; layers: LayerSnapshot[] }> {
    return this.consumeFromLayers(manager, {
      ...input,
      referenceType: 'purchase_return',
    });
  }

  async receiveTransfer(
    manager: EntityManager,
    input: ReceiveTransferInput,
  ): Promise<void> {
    for (const snapshot of input.snapshots) {
      if (snapshot.quantity <= 0) {
        continue;
      }

      const layer = manager.create(InventoryCostLayer, {
        productId: input.productId,
        warehouseId: input.warehouseId,
        originalQuantity: snapshot.quantity,
        remainingQuantity: snapshot.quantity,
        unitCost: this.round4(snapshot.unitCost),
        sourceType: 'stock_transfer_in',
        sourceId: input.sourceId,
        sourceLineId: null,
        parentLayerId: snapshot.sourceLayerId,
      });

      const saved = await manager.save(InventoryCostLayer, layer);

      await this.recordMovement(manager, {
        productId: input.productId,
        warehouseId: input.warehouseId,
        direction: InventoryMovementDirection.IN,
        quantity: snapshot.quantity,
        unitCost: this.round4(snapshot.unitCost),
        referenceType: 'stock_transfer_in',
        referenceId: input.sourceId,
        referenceLineId: null,
        sourceCostLayerId: saved.id,
        actorId: input.actorId ?? null,
      });
    }
  }

  async restoreFromSalesReturn(
    manager: EntityManager,
    input: RestoreSalesReturnInput,
  ): Promise<{ totalCost: number }> {
    if (input.quantity <= 0) {
      throw new BadRequestException('Return quantity must be greater than zero.');
    }

    const outboundMovements = await manager
      .createQueryBuilder(InventoryMovement, 'movement')
      .where('movement.reference_type = :referenceType', {
        referenceType: 'sale_delivery',
      })
      .andWhere('movement.reference_id = :referenceId', {
        referenceId: input.originalSaleId,
      })
      .andWhere('movement.product_id = :productId', { productId: input.productId })
      .andWhere('movement.warehouse_id = :warehouseId', { warehouseId: input.warehouseId })
      .andWhere('movement.direction = :direction', {
        direction: InventoryMovementDirection.OUT,
      })
      .orderBy('movement.created_at', 'ASC')
      .getMany();

    let remaining = input.quantity;
    let totalCost = 0;

    for (const movement of outboundMovements) {
      if (remaining <= 0) {
        break;
      }

      const recoverQty = Math.min(remaining, movement.quantity);
      if (recoverQty <= 0) {
        continue;
      }

      const unitCost = Number(movement.unitCost);
      const lineCost = this.round2(unitCost * recoverQty);
      totalCost = this.round2(totalCost + lineCost);

      if (movement.sourceCostLayerId) {
        const sourceLayer = await manager.findOne(InventoryCostLayer, {
          where: { id: movement.sourceCostLayerId },
          lock: { mode: 'pessimistic_write' },
        });

        if (sourceLayer) {
          sourceLayer.remainingQuantity = Math.min(
            sourceLayer.originalQuantity,
            sourceLayer.remainingQuantity + recoverQty,
          );
          await manager.save(InventoryCostLayer, sourceLayer);

          await this.recordMovement(manager, {
            productId: input.productId,
            warehouseId: input.warehouseId,
            direction: InventoryMovementDirection.IN,
            quantity: recoverQty,
            unitCost,
            referenceType: 'sales_return',
            referenceId: input.referenceId,
            referenceLineId: input.referenceLineId ?? null,
            sourceCostLayerId: sourceLayer.id,
            actorId: input.actorId ?? null,
          });

          remaining -= recoverQty;
          continue;
        }
      }

      const fallbackLayer = manager.create(InventoryCostLayer, {
        productId: input.productId,
        warehouseId: input.warehouseId,
        originalQuantity: recoverQty,
        remainingQuantity: recoverQty,
        unitCost: this.round4(unitCost),
        sourceType: 'sales_return',
        sourceId: input.referenceId,
        sourceLineId: input.referenceLineId ?? null,
        parentLayerId: movement.sourceCostLayerId,
      });
      const savedFallbackLayer = await manager.save(InventoryCostLayer, fallbackLayer);

      await this.recordMovement(manager, {
        productId: input.productId,
        warehouseId: input.warehouseId,
        direction: InventoryMovementDirection.IN,
        quantity: recoverQty,
        unitCost,
        referenceType: 'sales_return',
        referenceId: input.referenceId,
        referenceLineId: input.referenceLineId ?? null,
        sourceCostLayerId: savedFallbackLayer.id,
        actorId: input.actorId ?? null,
      });

      remaining -= recoverQty;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Unable to restore ${remaining} units for sales return due to missing delivery movements.`,
      );
    }

    return { totalCost };
  }

  private async consumeFromLayers(
    manager: EntityManager,
    input: ConsumeInput,
  ): Promise<{ totalCost: number; layers: LayerSnapshot[] }> {
    if (input.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero.');
    }

    const layers = await manager
      .createQueryBuilder(InventoryCostLayer, 'layer')
      .setLock('pessimistic_write')
      .where('layer.product_id = :productId', { productId: input.productId })
      .andWhere('layer.warehouse_id = :warehouseId', {
        warehouseId: input.warehouseId,
      })
      .andWhere('layer.remaining_quantity > 0')
      .orderBy('layer.created_at', 'ASC')
      .addOrderBy('layer.id', 'ASC')
      .getMany();

    let remaining = input.quantity;
    const consumed: LayerSnapshot[] = [];

    for (const layer of layers) {
      if (remaining <= 0) {
        break;
      }

      const consumeQty = Math.min(remaining, layer.remainingQuantity);
      if (consumeQty <= 0) {
        continue;
      }

      layer.remainingQuantity -= consumeQty;
      await manager.save(InventoryCostLayer, layer);

      const unitCost = Number(layer.unitCost);
      const totalCost = this.round2(unitCost * consumeQty);
      consumed.push({
        sourceLayerId: layer.id,
        quantity: consumeQty,
        unitCost,
        totalCost,
      });

      await this.recordMovement(manager, {
        productId: input.productId,
        warehouseId: input.warehouseId,
        direction: InventoryMovementDirection.OUT,
        quantity: consumeQty,
        unitCost,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        referenceLineId: input.referenceLineId ?? null,
        sourceCostLayerId: layer.id,
        actorId: input.actorId ?? null,
      });

      remaining -= consumeQty;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Insufficient FIFO layers for product ${input.productId} in warehouse ${input.warehouseId}. Missing quantity ${remaining}.`,
      );
    }

    const totalCost = this.round2(
      consumed.reduce((sum, item) => sum + item.totalCost, 0),
    );

    return {
      totalCost,
      layers: consumed,
    };
  }

  private async recordMovement(
    manager: EntityManager,
    input: {
      productId: string;
      warehouseId: string;
      direction: InventoryMovementDirection;
      quantity: number;
      unitCost: number;
      referenceType: string;
      referenceId: string;
      referenceLineId: string | null;
      sourceCostLayerId: string | null;
      actorId: string | null;
    },
  ): Promise<void> {
    const movement = manager.create(InventoryMovement, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      direction: input.direction,
      quantity: input.quantity,
      unitCost: this.round4(input.unitCost),
      totalCost: this.round2(input.unitCost * input.quantity),
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      referenceLineId: input.referenceLineId,
      sourceCostLayerId: input.sourceCostLayerId,
      createdBy: input.actorId,
    });

    await manager.save(InventoryMovement, movement);
  }

  private round2(value: number): number {
    return Number(value.toFixed(2));
  }

  private round4(value: number): number {
    return Number(value.toFixed(4));
  }
}
