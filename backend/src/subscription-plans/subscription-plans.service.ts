import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SubscriptionPlanEntity } from '../database/entities/subscription-plan.entity';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @InjectRepository(SubscriptionPlanEntity)
    private readonly plansRepository: Repository<SubscriptionPlanEntity>,
  ) {}

  async create(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlanEntity> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.plansRepository.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Subscription plan code "${code}" already exists.`);
    }

    const plan = this.plansRepository.create({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      monthlyPrice: Number(dto.monthlyPrice.toFixed(2)),
      yearlyPrice:
        dto.yearlyPrice !== undefined ? Number(dto.yearlyPrice.toFixed(2)) : null,
      maxUsers: dto.maxUsers ?? 5,
      maxWarehouses: dto.maxWarehouses ?? 1,
      maxProducts: dto.maxProducts ?? 500,
      features: dto.features ?? null,
      isActive: dto.isActive ?? true,
    });

    return this.plansRepository.save(plan);
  }

  async findAll(): Promise<SubscriptionPlanEntity[]> {
    return this.plansRepository.find({
      order: { monthlyPrice: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<SubscriptionPlanEntity> {
    const plan = await this.plansRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Subscription plan "${id}" not found.`);
    }
    return plan;
  }

  async update(
    id: string,
    dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanEntity> {
    const plan = await this.findOne(id);

    if (dto.code !== undefined) {
      const nextCode = dto.code.trim().toUpperCase();
      if (nextCode !== plan.code) {
        const duplicate = await this.plansRepository.findOne({
          where: { code: nextCode },
        });
        if (duplicate) {
          throw new ConflictException(
            `Subscription plan code "${nextCode}" already exists.`,
          );
        }
        plan.code = nextCode;
      }
    }

    if (dto.name !== undefined) {
      plan.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      plan.description = dto.description.trim() || null;
    }
    if (dto.monthlyPrice !== undefined) {
      plan.monthlyPrice = Number(dto.monthlyPrice.toFixed(2));
    }
    if (dto.yearlyPrice !== undefined) {
      plan.yearlyPrice = Number(dto.yearlyPrice.toFixed(2));
    }
    if (dto.maxUsers !== undefined) {
      plan.maxUsers = dto.maxUsers;
    }
    if (dto.maxWarehouses !== undefined) {
      plan.maxWarehouses = dto.maxWarehouses;
    }
    if (dto.maxProducts !== undefined) {
      plan.maxProducts = dto.maxProducts;
    }
    if (dto.features !== undefined) {
      plan.features = dto.features;
    }
    if (dto.isActive !== undefined) {
      plan.isActive = dto.isActive;
    }

    return this.plansRepository.save(plan);
  }

  async remove(id: string): Promise<void> {
    const plan = await this.findOne(id);
    await this.plansRepository.remove(plan);
  }
}
