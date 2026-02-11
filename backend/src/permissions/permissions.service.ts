import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Permission } from '../database/entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
  ) {}

  private normalizeSegment(value: string): string {
    return value.toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  }

  private buildSlug(module: string, action: string): string {
    return `${this.normalizeSegment(module)}.${this.normalizeSegment(action)}`;
  }

  private resolveModuleAction(module: string, action: string): {
    module: string;
    action: string;
  } {
    const normalizedActionInput = action.toLowerCase().trim().replace(':', '.');
    if (normalizedActionInput.includes('.')) {
      const parts = normalizedActionInput.split('.');
      if (parts.length === 2) {
        return {
          module: this.normalizeSegment(parts[0]),
          action: this.normalizeSegment(parts[1]),
        };
      }
    }

    return {
      module: this.normalizeSegment(module),
      action: this.normalizeSegment(action),
    };
  }

  async create(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    const moduleAction = this.resolveModuleAction(
      createPermissionDto.module,
      createPermissionDto.action,
    );
    const module = moduleAction.module;
    const action = moduleAction.action;
    const slug = this.buildSlug(module, action);

    const existingPermission = await this.permissionsRepository.findOne({
      where: { slug },
    });
    if (existingPermission) {
      throw new ConflictException(`Permission "${slug}" already exists.`);
    }

    const permission = this.permissionsRepository.create({
      module,
      action,
      slug,
      description: createPermissionDto.description?.trim() ?? null,
    });
    return this.permissionsRepository.save(permission);
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionsRepository.find({
      order: {
        module: 'ASC',
        action: 'ASC',
      },
    });
  }

  async findOne(id: string): Promise<Permission> {
    const permission = await this.permissionsRepository.findOne({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException(`Permission "${id}" not found.`);
    }
    return permission;
  }

  async findBySlug(slug: string): Promise<Permission> {
    const normalizedSlug = slug.toLowerCase().trim().replace(':', '.');
    const permission = await this.permissionsRepository.findOne({
      where: { slug: normalizedSlug },
    });
    if (!permission) {
      throw new NotFoundException(`Permission "${normalizedSlug}" not found.`);
    }
    return permission;
  }

  async findByModule(module: string): Promise<Permission[]> {
    return this.permissionsRepository.find({
      where: { module: this.normalizeSegment(module) },
      order: { action: 'ASC' },
    });
  }

  async update(
    id: string,
    updatePermissionDto: UpdatePermissionDto,
  ): Promise<Permission> {
    const permission = await this.findOne(id);

    let nextModule = permission.module;
    let nextAction = permission.action;
    if (updatePermissionDto.module || updatePermissionDto.action) {
      const moduleAction = this.resolveModuleAction(
        updatePermissionDto.module ?? permission.module,
        updatePermissionDto.action ?? permission.action,
      );
      nextModule = moduleAction.module;
      nextAction = moduleAction.action;
    }
    const nextSlug = this.buildSlug(nextModule, nextAction);

    if (nextSlug !== permission.slug) {
      const duplicatePermission = await this.permissionsRepository.findOne({
        where: { slug: nextSlug },
      });
      if (duplicatePermission && duplicatePermission.id !== id) {
        throw new ConflictException(`Permission "${nextSlug}" already exists.`);
      }
    }

    const updateData: Partial<Permission> = {
      module: nextModule,
      action: nextAction,
      slug: nextSlug,
    };
    if (updatePermissionDto.description !== undefined) {
      updateData.description = updatePermissionDto.description?.trim() ?? null;
    }

    await this.permissionsRepository.update(id, updateData);

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const permission = await this.findOne(id);
    await this.permissionsRepository.delete(id);
    this.logger.log(`Deleted permission "${permission.slug}" (${permission.id})`);
  }
}
