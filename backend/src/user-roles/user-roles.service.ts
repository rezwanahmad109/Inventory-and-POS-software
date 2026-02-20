import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

import { RoleName } from '../common/enums/role-name.enum';
import { UserRole } from '../database/entities/user-role.entity';
import { User } from '../database/entities/user.entity';
import { Role } from '../database/entities/role.entity';
import { Permission } from '../database/entities/permission.entity';

@Injectable()
export class UserRolesService {
  private readonly logger = new Logger(UserRolesService.name);

  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Assign a single role to a user
   */
  async assignRole(
    userId: string,
    roleId: string,
    assignedByUserId: string,
  ): Promise<UserRole> {
    this.logger.log(
      `Assigning role ${roleId} to user ${userId} by user ${assignedByUserId}`,
    );

    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Validate role exists
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Check if user already has this role
    const existingAssignment = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });
    if (existingAssignment) {
      throw new BadRequestException(
        `User ${userId} already has role ${roleId}`,
      );
    }

    // Create the assignment
    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
      assignedById: assignedByUserId,
    });

    const savedUserRole = await this.userRoleRepository.save(userRole);

    this.logger.log(
      `Successfully assigned role ${roleId} to user ${userId}`,
    );

    // Fetch and return with relations
    return this.userRoleRepository.findOne({
      where: { id: savedUserRole.id },
      relations: ['role', 'assignedBy'],
    }) as Promise<UserRole>;
  }

  /**
   * Assign multiple roles to a user using a transaction
   */
  async assignRoles(
    userId: string,
    roleIds: string[],
    assignedByUserId: string,
  ): Promise<UserRole[]> {
    const uniqueRoleIds = Array.from(new Set(roleIds));
    this.logger.log(
      `Assigning ${uniqueRoleIds.length} roles to user ${userId} by user ${assignedByUserId}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate user exists
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Validate all roles exist
      const roles = await queryRunner.manager.find(Role, {
        where: { id: In(uniqueRoleIds) },
      });
      if (roles.length !== uniqueRoleIds.length) {
        const foundIds = roles.map((r) => r.id);
        const missingIds = uniqueRoleIds.filter((id) => !foundIds.includes(id));
        throw new NotFoundException(
          `Roles not found: ${missingIds.join(', ')}`,
        );
      }

      // Get existing assignments
      const existingAssignments = await queryRunner.manager.find(UserRole, {
        where: { userId, roleId: In(uniqueRoleIds) },
      });
      const existingRoleIds = existingAssignments.map((ur) => ur.roleId);

      // Filter out roles already assigned
      const newRoleIds = uniqueRoleIds.filter((id) => !existingRoleIds.includes(id));

      if (newRoleIds.length === 0) {
        throw new BadRequestException(
          `User ${userId} already has all specified roles`,
        );
      }

      // Create new assignments
      const newUserRoles = newRoleIds.map((roleId) =>
        queryRunner.manager.create(UserRole, {
          userId,
          roleId,
          assignedById: assignedByUserId,
        }),
      );

      const savedUserRoles = await queryRunner.manager.save(newUserRoles);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Successfully assigned ${newRoleIds.length} roles to user ${userId}`,
      );

      // Fetch and return with relations
      return this.userRoleRepository.find({
        where: { id: In(savedUserRoles.map((ur) => ur.id)) },
        relations: ['role', 'assignedBy'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to assign roles to user ${userId}: ${error}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Remove a single role from a user
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    this.logger.log(`Removing role ${roleId} from user ${userId}`);
    await this.ensureSuperAdminRoleWillRemain(userId, [roleId], false);

    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });

    if (!userRole) {
      throw new NotFoundException(
        `User ${userId} does not have role ${roleId}`,
      );
    }

    await this.userRoleRepository.remove(userRole);
    this.logger.log(`Successfully removed role ${roleId} from user ${userId}`);
  }

  /**
   * Remove all roles from a user
   */
  async removeAllRoles(userId: string): Promise<void> {
    this.logger.log(`Removing all roles from user ${userId}`);
    await this.ensureSuperAdminRoleWillRemain(userId, [], true);

    const userRoles = await this.userRoleRepository.find({
      where: { userId },
    });

    if (userRoles.length === 0) {
      this.logger.warn(`User ${userId} has no roles to remove`);
      return;
    }

    await this.userRoleRepository.remove(userRoles);
    this.logger.log(`Successfully removed ${userRoles.length} roles from user ${userId}`);
  }

  /**
   * Get all roles assigned to a user
   */
  async getUserRoles(userId: string): Promise<UserRole[]> {
    this.logger.debug(`Fetching roles for user ${userId}`);

    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role', 'assignedBy'],
      order: { assignedAt: 'DESC' },
    });

    return userRoles;
  }

  /**
   * Get all permissions for a user based on their roles
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    this.logger.debug(`Fetching permissions for user ${userId}`);

    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role', 'role.rolePermissions', 'role.rolePermissions.permission'],
    });

    const permissionsMap = new Map<string, Permission>();

    for (const userRole of userRoles) {
      if (userRole.role?.rolePermissions) {
        for (const rolePermission of userRole.role.rolePermissions) {
          if (rolePermission.permission && !permissionsMap.has(rolePermission.permission.id)) {
            permissionsMap.set(rolePermission.permission.id, rolePermission.permission);
          }
        }
      }
    }

    return Array.from(permissionsMap.values());
  }

  /**
   * Get all users with a specific role
   */
  async getRoleUsers(roleId: string): Promise<UserRole[]> {
    this.logger.debug(`Fetching users with role ${roleId}`);

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const userRoles = await this.userRoleRepository.find({
      where: { roleId },
      relations: ['user', 'assignedBy'],
      order: { assignedAt: 'DESC' },
    });

    return userRoles;
  }

  /**
   * Check if a user has a specific role
   */
  async hasRole(userId: string, roleId: string): Promise<boolean> {
    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });
    return !!userRole;
  }

  /**
   * Check if a user has any of the specified roles
   */
  async hasAnyRole(userId: string, roleIds: string[]): Promise<boolean> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId, roleId: In(roleIds) },
    });
    return userRoles.length > 0;
  }

  /**
   * Check if a user has all of the specified roles
   */
  async hasAllRoles(userId: string, roleIds: string[]): Promise<boolean> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId, roleId: In(roleIds) },
    });
    const userRoleIds = userRoles.map((ur) => ur.roleId);
    return roleIds.every((roleId) => userRoleIds.includes(roleId));
  }

  private async ensureSuperAdminRoleWillRemain(
    userId: string,
    removingRoleIds: string[],
    removingAllRoles: boolean,
  ): Promise<void> {
    const superAdminRole = await this.roleRepository.findOne({
      where: { name: RoleName.SUPER_ADMIN },
    });
    if (!superAdminRole) {
      return;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['userRoles'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const userRoleIds = new Set<string>((user.userRoles ?? []).map((userRole) => userRole.roleId));
    const currentlySuperAdmin = userRoleIds.has(superAdminRole.id);

    const removesSuperAdmin =
      removingAllRoles ||
      removingRoleIds.includes(superAdminRole.id);

    if (!currentlySuperAdmin || !removesSuperAdmin) {
      return;
    }

    const superAdminAssignments = await this.userRoleRepository.count({
      where: { roleId: superAdminRole.id },
    });
    if (superAdminAssignments <= 1) {
      throw new BadRequestException(
        'Cannot remove super admin role from the last super admin user.',
      );
    }
  }
}
