import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import {
  OutboxEvent,
  OutboxEventStatus,
} from '../../database/entities/outbox-event.entity';

export interface EnqueueOutboxInput {
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}

@Injectable()
export class OutboxService {
  constructor(private readonly dataSource: DataSource) {}

  async enqueue(
    manager: EntityManager,
    input: EnqueueOutboxInput,
  ): Promise<OutboxEvent> {
    if (input.idempotencyKey) {
      const existing = await manager.findOne(OutboxEvent, {
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    const row = manager.create(OutboxEvent, {
      eventType: input.eventType,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      status: OutboxEventStatus.PENDING,
      attempts: 0,
      lastError: null,
      nextAttemptAt: null,
      processedAt: null,
    });

    return manager.save(OutboxEvent, row);
  }

  async listFailed(limit = 100): Promise<OutboxEvent[]> {
    return this.dataSource.getRepository(OutboxEvent).find({
      where: { status: OutboxEventStatus.FAILED },
      order: { updatedAt: 'DESC' },
      take: Math.max(1, Math.min(limit, 500)),
    });
  }

  async retryFailedEvent(eventId: string): Promise<OutboxEvent> {
    const repository = this.dataSource.getRepository(OutboxEvent);
    const row = await repository.findOne({ where: { id: eventId } });
    if (!row) {
      throw new NotFoundException(`Outbox event "${eventId}" not found.`);
    }

    row.status = OutboxEventStatus.PENDING;
    row.nextAttemptAt = null;
    row.lastError = null;
    return repository.save(row);
  }

  async retryAllFailedEvents(): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(OutboxEvent)
      .set({
        status: OutboxEventStatus.PENDING,
        nextAttemptAt: null,
        lastError: null,
      })
      .where('status = :status', { status: OutboxEventStatus.FAILED })
      .execute();

    return Number(result.affected ?? 0);
  }
}
