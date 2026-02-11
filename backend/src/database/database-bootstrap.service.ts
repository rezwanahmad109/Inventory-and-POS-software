import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { RoleName } from '../common/enums/role-name.enum';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { runSeed } from './seeds/permission.seed';

@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionsRepository: Repository<Permission>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionsRepository: Repository<RolePermission>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureRoles();
    await this.runPermissionSeed();
    await this.ensureDefaultAdminUser();
  }

  private async runPermissionSeed(): Promise<void> {
    try {
      await runSeed(
        this.permissionsRepository,
        this.rolesRepository,
        this.rolePermissionsRepository,
      );
    } catch (error) {
      this.logger.error('Failed to run permission seed', error);
    }
  }

  private async ensureRoles(): Promise<void> {
    const roleNames = Object.values(RoleName);

    for (const roleName of roleNames) {
      const existing = await this.rolesRepository.findOne({
        where: { name: roleName },
      });
      if (!existing) {
        await this.rolesRepository.save(
          this.rolesRepository.create({
            name: roleName,
            isSystem: true,
            description: `${roleName.replace('_', ' ')} role`,
          }),
        );
        this.logger.log(`Seeded role "${roleName}".`);
      }
    }
  }

  private async ensureUserRoleAssignment(userId: string, roleId: string): Promise<void> {
    const existingAssignment = await this.userRolesRepository.findOne({
      where: {
        userId,
        roleId,
      },
    });

    if (!existingAssignment) {
      await this.userRolesRepository.save(
        this.userRolesRepository.create({
          userId,
          roleId,
          assignedById: null,
        }),
      );
    }
  }

  private async ensureDefaultAdminUser(): Promise<void> {
    const adminEmail = this.configService
      .get<string>('ADMIN_EMAIL', 'admin@inventory.local')
      .toLowerCase()
      .trim();
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const bootstrapRoleName = this.configService
      .get<string>('ADMIN_ROLE', RoleName.SUPER_ADMIN)
      .toLowerCase()
      .trim();

    const bootstrapRole = await this.rolesRepository.findOne({
      where: { name: bootstrapRoleName },
    });
    if (!bootstrapRole) {
      this.logger.warn(
        `Bootstrap role "${bootstrapRoleName}" is missing. Skipping default admin creation.`,
      );
      return;
    }

    const existingAdmin = await this.usersRepository.findOne({
      where: { email: adminEmail },
      relations: ['role'],
    });
    if (existingAdmin) {
      // Keep legacy role_id and user_roles in sync for existing bootstrap user.
      if (existingAdmin.roleId !== bootstrapRole.id) {
        existingAdmin.role = bootstrapRole;
        existingAdmin.roleId = bootstrapRole.id;
        await this.usersRepository.save(existingAdmin);
      }

      await this.ensureUserRoleAssignment(existingAdmin.id, bootstrapRole.id);
      return;
    }

    const adminPassword = this.configService.get<string>(
      'ADMIN_PASSWORD',
      'ChangeMe123!',
    );
    if (nodeEnv === 'production' && adminPassword === 'ChangeMe123!') {
      throw new Error(
        'ADMIN_PASSWORD must be explicitly set in production before startup.',
      );
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const admin = this.usersRepository.create({
      email: adminEmail,
      password: passwordHash,
      name: this.configService.get<string>('ADMIN_NAME', 'System Admin'),
      role: bootstrapRole,
      roleId: bootstrapRole.id,
      isActive: true,
    });

    const savedAdmin = await this.usersRepository.save(admin);
    await this.ensureUserRoleAssignment(savedAdmin.id, bootstrapRole.id);
    this.logger.log(
      `Seeded default admin user "${adminEmail}". Change ADMIN_PASSWORD immediately in production.`,
    );
  }
}
