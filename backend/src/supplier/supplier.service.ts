import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Purchase } from '../database/entities/purchase.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
  ) {}

  async findAll(): Promise<Supplier[]> {
    return this.supplierRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({ where: { id } });
    if (!supplier) {
      throw new NotFoundException(`Supplier "${id}" not found.`);
    }
    return supplier;
  }

  async create(createSupplierDto: CreateSupplierDto): Promise<Supplier> {
    const normalizedEmail = createSupplierDto.email?.toLowerCase().trim();
    if (normalizedEmail) {
      const exists = await this.supplierRepository.findOne({
        where: { email: normalizedEmail },
      });
      if (exists) {
        throw new ConflictException(
          `Supplier with email "${normalizedEmail}" already exists.`,
        );
      }
    }

    const supplier = this.supplierRepository.create({
      name: createSupplierDto.name.trim(),
      contactName: createSupplierDto.contactName?.trim() || null,
      phone: createSupplierDto.phone?.trim() || null,
      email: normalizedEmail ?? null,
      address: createSupplierDto.address?.trim() || null,
    });

    return this.supplierRepository.save(supplier);
  }

  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto,
  ): Promise<Supplier> {
    const supplier = await this.findOne(id);

    const nextEmail = updateSupplierDto.email?.toLowerCase().trim();
    if (nextEmail && nextEmail !== supplier.email) {
      const duplicate = await this.supplierRepository.findOne({
        where: { email: nextEmail },
      });
      if (duplicate) {
        throw new ConflictException(
          `Supplier with email "${nextEmail}" already exists.`,
        );
      }
    }

    const merged = this.supplierRepository.merge(supplier, {
      name: updateSupplierDto.name?.trim(),
      contactName:
        updateSupplierDto.contactName === undefined
          ? undefined
          : (updateSupplierDto.contactName.trim() || null),
      phone:
        updateSupplierDto.phone === undefined
          ? undefined
          : (updateSupplierDto.phone.trim() || null),
      email:
        updateSupplierDto.email === undefined
          ? undefined
          : (nextEmail || null),
      address:
        updateSupplierDto.address === undefined
          ? undefined
          : (updateSupplierDto.address.trim() || null),
    });

    return this.supplierRepository.save(merged);
  }

  async remove(id: string): Promise<void> {
    const supplier = await this.findOne(id);

    const linkedPurchaseCount = await this.purchaseRepository.count({
      where: { supplierId: supplier.id },
    });
    if (linkedPurchaseCount > 0) {
      throw new BadRequestException(
        'Cannot delete supplier because purchase records are linked to it.',
      );
    }

    await this.supplierRepository.remove(supplier);
  }
}
