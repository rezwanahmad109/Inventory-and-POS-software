import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { PeriodLock } from '../../database/entities/period-lock.entity';

interface LockPeriodInput {
  startDate: string;
  endDate: string;
  reason?: string;
}

@Injectable()
export class PeriodLockService {
  constructor(
    @InjectRepository(PeriodLock)
    private readonly periodLockRepository: Repository<PeriodLock>,
  ) {}

  async lockPeriod(input: LockPeriodInput, actorId: string): Promise<PeriodLock> {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('startDate and endDate must be valid dates.');
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate cannot be later than endDate.');
    }

    const overlapping = await this.periodLockRepository
      .createQueryBuilder('period')
      .where('period.is_locked = TRUE')
      .andWhere('period.start_date <= :endDate', { endDate })
      .andWhere('period.end_date >= :startDate', { startDate })
      .getOne();

    if (overlapping) {
      throw new BadRequestException(
        `A locked period already exists between ${overlapping.startDate.toISOString().slice(0, 10)} and ${overlapping.endDate.toISOString().slice(0, 10)}.`,
      );
    }

    const row = this.periodLockRepository.create({
      startDate,
      endDate,
      reason: input.reason?.trim() ?? null,
      lockedBy: actorId,
      isLocked: true,
    });

    return this.periodLockRepository.save(row);
  }

  async unlockPeriod(periodLockId: string): Promise<PeriodLock> {
    const periodLock = await this.periodLockRepository.findOne({
      where: { id: periodLockId },
    });
    if (!periodLock) {
      throw new NotFoundException(`Period lock "${periodLockId}" not found.`);
    }

    periodLock.isLocked = false;
    return this.periodLockRepository.save(periodLock);
  }

  async list(): Promise<PeriodLock[]> {
    return this.periodLockRepository.find({
      order: {
        startDate: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  async assertDateOpen(date: Date, manager?: EntityManager): Promise<void> {
    const repository = manager
      ? manager.getRepository(PeriodLock)
      : this.periodLockRepository;

    const lock = await repository
      .createQueryBuilder('period')
      .where('period.is_locked = TRUE')
      .andWhere('period.start_date <= :postingDate', { postingDate: date })
      .andWhere('period.end_date >= :postingDate', { postingDate: date })
      .getOne();

    if (!lock) {
      return;
    }

    throw new BadRequestException(
      `Posting date ${date.toISOString().slice(0, 10)} is in a locked period (${lock.startDate.toISOString().slice(0, 10)} to ${lock.endDate.toISOString().slice(0, 10)}).`,
    );
  }
}
