import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      this.logger.warn('Permission check failed: Missing authenticated user context');
      throw new ForbiddenException('Missing authenticated user context.');
    }

    // Super admin bypasses all permission checks
    if (user.role === 'super_admin') {
      this.logger.debug(
        `Super admin user ${user.userId} bypassed permission check for: ${requiredPermissions.join(', ')}`,
      );
      return true;
    }

    // Check if user has all required permissions
    const userPermissions = user.permissions || [];
    const hasAllPermissions = requiredPermissions.every((permission: string) =>
      userPermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        (permission: string) => !userPermissions.includes(permission),
      );
      this.logger.warn(
        `User ${user.userId} (${user.email}) lacks required permissions: ${missingPermissions.join(', ')}`,
      );
      throw new ForbiddenException(
        `You do not have the required permissions to access this resource. Missing: ${missingPermissions.join(', ')}`,
      );
    }

    this.logger.debug(
      `User ${user.userId} granted access with permissions: ${requiredPermissions.join(', ')}`,
    );
    return true;
  }
}
