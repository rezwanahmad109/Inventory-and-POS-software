import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Permission } from '../database/entities/permission.entity';
import { RolePermission } from '../database/entities/role-permission.entity';
import { Role } from '../database/entities/role.entity';
import { UserRole } from '../database/entities/user-role.entity';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionsRepository: Repository<RolePermission>,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
  ) {}

  private normalizeRoleName(name: string): string {
    return name.toLowerCase().trim();
  }

  private async findRoleOrFail(id: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id },
      relations: ['rolePermissions', 'rolePermissions.permission', 'createdBy'],
    });

    if (!role) {
      throw new NotFoundException(`Role "${id}" not found.`);
    }

    return role;
  }

  private async ensurePermissionsExist(permissionIds: string[]): Promise<Permission[]> {
    if (permissionIds.length === 0) {
      return [];
    }

    const permissions = await this.permissionsRepository.find({
      where: { id: In(permissionIds) },
    });

    const foundIds = new Set<string>(permissions.map((permission) => permission.id));
    const missingIds = permissionIds.filter((permissionId) => !foundIds.has(permissionId));
    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Some permissions do not exist: ${missingIds.join(', ')}`,
      );
    }

    return permissions;
  }

  async create(createRoleDto: CreateRoleDto, createdByUserId?: string): Promise<Role> {
    const normalizedRoleName = this.normalizeRoleName(createRoleDto.name);

    const existingRole = await this.rolesRepository
      .createQueryBuilder('role')
      .where('LOWER(role.name) = :name', { name: normalizedRoleName })
      .getOne();

    if (existingRole) {
      throw new ConflictException(`Role "${normalizedRoleName}" already exists.`);
    }

    const role = this.rolesRepository.create({
      name: normalizedRoleName,
      description: createRoleDto.description?.trim() ?? null,
      createdById: createdByUserId ?? null,
      isSystem: false,
    });

    const savedRole = await this.rolesRepository.save(role);
    return this.findRoleOrFail(savedRole.id);
  }

  async findAll(): Promise<Role[]> {
    return this.rolesRepository.find({
      relations: ['rolePermissions', 'rolePermissions.permission', 'createdBy'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Role> {
    return this.findRoleOrFail(id);
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.findRoleOrFail(id);

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified.');
    }

    if (updateRoleDto.name) {
      const normalizedRoleName = this.normalizeRoleName(updateRoleDto.name);
      const duplicateRole = await this.rolesRepository
        .createQueryBuilder('role')
        .where('LOWER(role.name) = :name', { name: normalizedRoleName })
        .andWhere('role.id != :id', { id })
        .getOne();

      if (duplicateRole) {
        throw new ConflictException(`Role "${normalizedRoleName}" already exists.`);
      }

      role.name = normalizedRoleName;
    }

    if (updateRoleDto.description !== undefined) {
      role.description = updateRoleDto.description?.trim() ?? null;
    }

    await this.rolesRepository.save(role);
    return this.findRoleOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findRoleOrFail(id);

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted.');
    }

    const userRoleCount = await this.userRolesRepository.count({
      where: { roleId: id },
    });
    if (userRoleCount > 0) {
      throw new BadRequestException(
        'Role is assigned to users and cannot be deleted.',
      );
    }

    await this.rolesRepository.delete(id);
  }

  async getRolePermissions(id: string): Promise<Permission[]> {
    const role = await this.findRoleOrFail(id);
    return (role.rolePermissions ?? [])
      .map((rolePermission) => rolePermission.permission)
      .filter((permission): permission is Permission => Boolean(permission))
      .sort((a, b) => a.module.localeCompare(b.module) || a.action.localeCompare(b.action));
  }

  async assignPermissions(
    roleId: string,
    assignPermissionsDto: AssignPermissionsDto,
  ): Promise<{
    roleId: string;
    permissions: Permission[];
  }> {
    if (assignPermissionsDto.roleId !== roleId) {
      throw new BadRequestException('Role ID in path and body must match.');
    }

    const uniquePermissionIds = Array.from(new Set(assignPermissionsDto.permissionIds));
    await this.findRoleOrFail(roleId);
    const permissions = await this.ensurePermissionsExist(uniquePermissionIds);

    await this.rolesRepository.manager.transaction(async (manager) => {
      await manager.delete(RolePermission, { roleId });

      if (permissions.length === 0) {
        return;
      }

      const assignments = permissions.map((permission) =>
        manager.create(RolePermission, {
          roleId,
          permissionId: permission.id,
        }),
      );
      await manager.save(RolePermission, assignments);
    });

    return {
      roleId,
      permissions: await this.getRolePermissions(roleId),
    };
  }

  async removePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.findRoleOrFail(roleId);

    if (permissionIds.length === 0) {
      return;
    }

    await this.rolePermissionsRepository.delete({
      roleId,
      permissionId: In(permissionIds),
    });
  }
}
