import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleName } from '../enums/role-name.enum';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  private normalizePermissionSlug(permission: string): string {
    const normalized = permission.toLowerCase().trim().replace(/:/g, '.');
    const parts = normalized.split('.');
    if (parts.length !== 2) {
      return normalized;
    }

    const module = parts[0].replace(/-/g, '_');
    const action = parts[1].replace(/-/g, '_');
    return `${module}.${action}`;
  }

  private normalizeRoleName(roleName: string): string {
    return roleName.toLowerCase().trim();
  }

  private collectUserRoles(user: RequestUser): Set<string> {
    const roles = new Set<string>();
    if (user.role && user.role.trim().length > 0) {
      roles.add(this.normalizeRoleName(user.role));
    }
    for (const role of user.roles ?? []) {
      if (role && role.trim().length > 0) {
        roles.add(this.normalizeRoleName(role));
      }
    }
    return roles;
  }

  private userIsSuperAdmin(user: RequestUser): boolean {
    return this.collectUserRoles(user).has(RoleName.SUPER_ADMIN);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Missing authenticated user context.');
    }

    if (this.userIsSuperAdmin(user)) {
      this.logger.debug(`Super admin user ${user.userId} bypassed authorization checks.`);
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions && requiredPermissions.length > 0) {
      const normalizedUserPermissions = new Set(
        (user.permissions ?? []).map((permission) =>
          this.normalizePermissionSlug(permission),
        ),
      );

      const missingPermissions = requiredPermissions.filter((requiredPermission) => {
        const normalizedRequiredPermission = this.normalizePermissionSlug(
          requiredPermission,
        );
        return !normalizedUserPermissions.has(normalizedRequiredPermission);
      });

      if (missingPermissions.length > 0) {
        throw new ForbiddenException(
          `You do not have required permissions: ${missingPermissions.join(', ')}`,
        );
      }
    }

    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const userRoles = this.collectUserRoles(user);
    const allowedRoles = requiredRoles.map((role) => this.normalizeRoleName(role));

    const hasAllowedRole = allowedRoles.some((role) => userRoles.has(role));
    if (!hasAllowedRole) {
      throw new ForbiddenException(
        `Role "${Array.from(userRoles).join(', ') || 'none'}" is not permitted for this resource.`,
      );
    }

    return true;
  }
}
