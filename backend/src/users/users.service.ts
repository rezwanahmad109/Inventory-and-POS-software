import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, Repository } from 'typeorm';

import { RoleName } from '../common/enums/role-name.enum';
import { Permission } from '../database/entities/permission.entity';
import { Role } from '../database/entities/role.entity';
import { RolePermission } from '../database/entities/role-permission.entity';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/entities/user-role.entity';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus } from './dto/user-status.enum';

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  roleName: string;
}

export interface UserAccessProfile {
  user: User;
  roles: string[];
  permissions: string[];
  primaryRole: string;
}

export interface ManagedUserProfile {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roleId: string | null;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionsRepository: Repository<RolePermission>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = this.normalizeEmail(email);
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .where('LOWER(user.email) = :email', { email: normalizedEmail })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: ['role'],
    });
  }

  async findAllManagedUsers(): Promise<ManagedUserProfile[]> {
    const users = await this.usersRepository.find({
      relations: ['role', 'userRoles', 'userRoles.role'],
      order: { createdAt: 'DESC' },
    });

    return users.map((user) => this.toManagedUserProfile(user));
  }

  async findManagedUserById(userId: string): Promise<ManagedUserProfile> {
    const user = await this.findUserWithRolesOrFail(userId);
    return this.toManagedUserProfile(user);
  }

  async createManagedUser(
    createUserDto: CreateUserDto,
    createdByUserId: string,
  ): Promise<ManagedUserProfile> {
    const email = this.normalizeEmail(createUserDto.email);

    const existing = await this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email })
      .getOne();

    if (existing) {
      throw new ConflictException(`User with email "${email}" already exists.`);
    }

    const role = await this.ensureRoleExists(createUserDto.roleId);
    const passwordHash = await bcrypt.hash(createUserDto.password, 12);

    const user = this.usersRepository.create({
      name: this.normalizeName(createUserDto.name),
      email,
      password: passwordHash,
      isActive: createUserDto.status !== UserStatus.INACTIVE,
      roleId: role.id,
    });

    const savedUser = await this.usersRepository.save(user);

    await this.userRolesRepository.save(
      this.userRolesRepository.create({
        userId: savedUser.id,
        roleId: role.id,
        assignedById: createdByUserId,
      }),
    );

    return this.findManagedUserById(savedUser.id);
  }

  async updateManagedUser(
    userId: string,
    updateUserDto: UpdateUserDto,
    updatedByUserId: string,
  ): Promise<ManagedUserProfile> {
    const user = await this.findUserWithRolesOrFail(userId);

    if (updateUserDto.email !== undefined) {
      const email = this.normalizeEmail(updateUserDto.email);
      const duplicate = await this.usersRepository
        .createQueryBuilder('user')
        .where('LOWER(user.email) = :email', { email })
        .andWhere('user.id != :userId', { userId })
        .getOne();

      if (duplicate) {
        throw new ConflictException(`User with email "${email}" already exists.`);
      }

      user.email = email;
    }

    if (updateUserDto.name !== undefined) {
      user.name = this.normalizeName(updateUserDto.name);
    }

    if (updateUserDto.password !== undefined) {
      user.password = await bcrypt.hash(updateUserDto.password, 12);
    }

    if (updateUserDto.status !== undefined) {
      user.isActive = updateUserDto.status === UserStatus.ACTIVE;
    }

    if (updateUserDto.roleId !== undefined) {
      const role = await this.ensureRoleExists(updateUserDto.roleId);
      user.role = role;
      user.roleId = role.id;

      const existingAssignment = await this.userRolesRepository.findOne({
        where: {
          userId,
          roleId: role.id,
        },
      });

      if (!existingAssignment) {
        await this.userRolesRepository.save(
          this.userRolesRepository.create({
            userId,
            roleId: role.id,
            assignedById: updatedByUserId,
          }),
        );
      }
    }

    await this.usersRepository.save(user);
    return this.findManagedUserById(userId);
  }

  async assignRolesToUser(
    userId: string,
    assignUserRolesDto: AssignUserRolesDto,
    assignedByUserId: string,
  ): Promise<ManagedUserProfile> {
    const user = await this.findUserWithRolesOrFail(userId);

    const uniqueRoleIds = Array.from(new Set(assignUserRolesDto.roleIds));
    await this.ensureRolesExist(uniqueRoleIds);

    if (
      assignUserRolesDto.primaryRoleId &&
      !uniqueRoleIds.includes(assignUserRolesDto.primaryRoleId)
    ) {
      throw new BadRequestException('primaryRoleId must be included in roleIds.');
    }

    const primaryRoleId = assignUserRolesDto.primaryRoleId ?? uniqueRoleIds[0];
    await this.ensureSuperAdminRetentionOnRoleReplace(user, uniqueRoleIds);

    await this.usersRepository.manager.transaction(async (manager) => {
      await manager.delete(UserRole, { userId });

      const userRoles = uniqueRoleIds.map((roleId) =>
        manager.create(UserRole, {
          userId,
          roleId,
          assignedById: assignedByUserId,
        }),
      );

      await manager.save(UserRole, userRoles);
      await manager.update(User, userId, { roleId: primaryRoleId });
    });

    return this.findManagedUserById(userId);
  }

  async removeManagedUser(userId: string, requestedByUserId: string): Promise<void> {
    if (userId === requestedByUserId) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const user = await this.findUserWithRolesOrFail(userId);
    await this.ensureNotLastSuperAdmin(user);

    await this.usersRepository.delete(userId);
  }

  private normalizeRoleName(roleName: string): string {
    return roleName.toLowerCase().trim();
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private normalizeName(name: string): string {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Name cannot be empty.');
    }

    return normalizedName;
  }

  private normalizePermissionSlug(permission: Permission): string {
    const module = permission.module.toLowerCase().trim().replace(/-/g, '_');
    const action = permission.action.toLowerCase().trim().replace(/-/g, '_');
    const preferredSlug = permission.slug
      ?.toLowerCase()
      .trim()
      .replace(':', '.');

    return preferredSlug && preferredSlug.length > 0
      ? preferredSlug
      : `${module}.${action}`;
  }

  private async resolveRoleByName(roleName: string): Promise<Role> {
    const normalizedRoleName = this.normalizeRoleName(roleName);
    const role = await this.rolesRepository
      .createQueryBuilder('role')
      .where('LOWER(role.name) = :roleName', { roleName: normalizedRoleName })
      .getOne();

    if (!role) {
      throw new NotFoundException(`Role "${normalizedRoleName}" was not found.`);
    }

    return role;
  }

  private async ensureRoleExists(roleId: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role "${roleId}" was not found.`);
    }

    return role;
  }

  private async ensureRolesExist(roleIds: string[]): Promise<Role[]> {
    const roles = await this.rolesRepository.find({
      where: { id: In(roleIds) },
    });

    if (roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map((role) => role.id));
      const missingIds = roleIds.filter((roleId) => !foundIds.has(roleId));
      throw new NotFoundException(`Some roles were not found: ${missingIds.join(', ')}`);
    }

    return roles;
  }

  private async findUserWithRolesOrFail(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['role', 'userRoles', 'userRoles.role'],
    });

    if (!user) {
      throw new NotFoundException(`User "${userId}" was not found.`);
    }

    return user;
  }

  private async ensureSuperAdminRetentionOnRoleReplace(
    user: User,
    replacementRoleIds: string[],
  ): Promise<void> {
    const superAdminRole = await this.rolesRepository.findOne({
      where: { name: RoleName.SUPER_ADMIN },
    });

    if (!superAdminRole) {
      return;
    }

    const currentlySuperAdmin =
      user.roleId === superAdminRole.id ||
      (user.userRoles ?? []).some((userRole) => userRole.roleId === superAdminRole.id);
    const remainsSuperAdmin = replacementRoleIds.includes(superAdminRole.id);

    if (!currentlySuperAdmin || remainsSuperAdmin) {
      return;
    }

    const superAdminAssignments = await this.userRolesRepository.count({
      where: { roleId: superAdminRole.id },
    });

    const superAdminLegacyUsers = await this.usersRepository.count({
      where: { roleId: superAdminRole.id },
    });

    if (Math.max(superAdminAssignments, superAdminLegacyUsers) <= 1) {
      throw new BadRequestException(
        'Cannot remove super admin role from the last super admin user.',
      );
    }
  }

  private async ensureNotLastSuperAdmin(user: User): Promise<void> {
    const superAdminRole = await this.rolesRepository.findOne({
      where: { name: RoleName.SUPER_ADMIN },
    });

    if (!superAdminRole) {
      return;
    }

    const hasSuperAdminRole =
      user.roleId === superAdminRole.id ||
      (user.userRoles ?? []).some((userRole) => userRole.roleId === superAdminRole.id);

    if (!hasSuperAdminRole) {
      return;
    }

    const superAdminAssignments = await this.userRolesRepository.count({
      where: { roleId: superAdminRole.id },
    });

    const superAdminLegacyUsers = await this.usersRepository.count({
      where: { roleId: superAdminRole.id },
    });

    if (Math.max(superAdminAssignments, superAdminLegacyUsers) <= 1) {
      throw new BadRequestException('Cannot delete the last super admin user.');
    }
  }

  private toManagedUserProfile(user: User): ManagedUserProfile {
    const roles = new Set<string>();

    for (const userRole of user.userRoles ?? []) {
      const roleName = userRole.role?.name?.toLowerCase().trim();
      if (roleName) {
        roles.add(roleName);
      }
    }

    if (roles.size === 0 && user.role?.name) {
      roles.add(user.role.name.toLowerCase().trim());
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.isActive ? UserStatus.ACTIVE : UserStatus.INACTIVE,
      roleId: user.roleId ?? null,
      roles: Array.from(roles),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getUserAccessProfile(userId: string): Promise<UserAccessProfile> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: [
        'role',
        'userRoles',
        'userRoles.role',
        'userRoles.role.rolePermissions',
        'userRoles.role.rolePermissions.permission',
      ],
    });

    if (!user) {
      throw new NotFoundException(`User "${userId}" was not found.`);
    }

    const roles = new Set<string>();
    const permissions = new Set<string>();

    for (const userRole of user.userRoles ?? []) {
      const roleName = userRole.role?.name?.toLowerCase().trim();
      if (!roleName) {
        continue;
      }

      roles.add(roleName);
      for (const rolePermission of userRole.role.rolePermissions ?? []) {
        if (rolePermission.permission) {
          permissions.add(this.normalizePermissionSlug(rolePermission.permission));
        }
      }
    }

    // Backward compatibility while legacy users.role_id still exists.
    if (roles.size === 0 && user.role?.name) {
      const legacyRoleName = user.role.name.toLowerCase().trim();
      roles.add(legacyRoleName);

      const legacyRolePermissions = await this.rolePermissionsRepository.find({
        where: { roleId: user.role.id },
        relations: ['permission'],
      });
      for (const rolePermission of legacyRolePermissions) {
        if (rolePermission.permission) {
          permissions.add(this.normalizePermissionSlug(rolePermission.permission));
        }
      }
    }

    const roleList = Array.from(roles);
    const normalizedPrimaryRole = user.role?.name?.toLowerCase().trim();

    const primaryRole = roleList.includes(RoleName.SUPER_ADMIN)
      ? RoleName.SUPER_ADMIN
      : normalizedPrimaryRole && roleList.includes(normalizedPrimaryRole)
        ? normalizedPrimaryRole
        : roleList[0] ?? RoleName.VIEWER;

    return {
      user,
      roles: roleList,
      permissions: Array.from(permissions),
      primaryRole,
    };
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException(`User with email "${email}" already exists.`);
    }

    const role = await this.resolveRoleByName(input.roleName);

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = this.usersRepository.create({
      email,
      password: passwordHash,
      name: this.normalizeName(input.name),
      role,
      roleId: role.id,
      isActive: true,
    });

    const savedUser = await this.usersRepository.save(user);

    const existingUserRole = await this.userRolesRepository.findOne({
      where: {
        userId: savedUser.id,
        roleId: role.id,
      },
    });

    if (!existingUserRole) {
      const userRole = this.userRolesRepository.create({
        userId: savedUser.id,
        roleId: role.id,
        assignedById: null,
      });
      await this.userRolesRepository.save(userRole);
    }

    return savedUser;
  }
}
