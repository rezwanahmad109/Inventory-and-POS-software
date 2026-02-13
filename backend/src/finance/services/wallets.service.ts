import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Wallet } from '../../database/entities/wallet.entity';
import { CreateWalletDto } from '../dto/create-wallet.dto';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  async create(dto: CreateWalletDto): Promise<Wallet> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.walletRepository.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Wallet code "${code}" already exists.`);
    }

    const openingBalance = Number((dto.openingBalance ?? 0).toFixed(2));
    const wallet = this.walletRepository.create({
      code,
      name: dto.name.trim(),
      type: dto.type,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      openingBalance,
      currentBalance: openingBalance,
    });

    return this.walletRepository.save(wallet);
  }

  async findAll(): Promise<Wallet[]> {
    return this.walletRepository.find({ order: { createdAt: 'DESC' } });
  }
}
