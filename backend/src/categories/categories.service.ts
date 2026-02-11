import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Category, Product } from '../database/entities/product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const name = createCategoryDto.name.trim();
    await this.ensureUniqueName(name);

    const category = this.categoriesRepository.create({
      name,
      description: createCategoryDto.description?.trim() ?? null,
    });

    return this.categoriesRepository.save(category);
  }

  async findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Category "${id}" not found.`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    if (updateCategoryDto.name !== undefined) {
      const nextName = updateCategoryDto.name.trim();
      if (nextName.toLowerCase() !== category.name.toLowerCase()) {
        await this.ensureUniqueName(nextName, category.id);
      }
      category.name = nextName;
    }

    if (updateCategoryDto.description !== undefined) {
      category.description = updateCategoryDto.description.trim() || null;
    }

    return this.categoriesRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);

    const activeProducts = await this.productsRepository.count({
      where: { categoryId: category.id },
    });

    if (activeProducts > 0) {
      throw new BadRequestException(
        'Cannot delete category because active products are linked to it.',
      );
    }

    await this.categoriesRepository.softDelete(category.id);
  }

  private async ensureUniqueName(name: string, ignoreId?: string): Promise<void> {
    const query = this.categoriesRepository
      .createQueryBuilder('category')
      .where('LOWER(category.name) = LOWER(:name)', { name });

    if (ignoreId) {
      query.andWhere('category.id <> :ignoreId', { ignoreId });
    }

    const duplicate = await query.getOne();
    if (!duplicate) {
      return;
    }

    throw new ConflictException(`Category "${name}" already exists.`);
  }
}
