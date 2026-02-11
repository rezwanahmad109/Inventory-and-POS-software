import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UserRolesService } from './user-roles.service';
import { AssignRolesDto } from './dto/assign-roles.dto';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('user-roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  /**
   * POST /user-roles/:userId/roles - Assign roles to a user
   * Requires permission: 'user-roles:assign'
   */
  @Post(':userId/roles')
  @Permissions('user_roles.assign')
  async assignRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRolesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userRolesService.assignRoles(
      userId,
      dto.roleIds,
      request.user.userId,
    );
  }

  /**
   * DELETE /user-roles/:userId/roles/:roleId - Remove a specific role from a user
   * Requires permission: 'user-roles:remove'
   */
  @Delete(':userId/roles/:roleId')
  @Permissions('user_roles.remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    await this.userRolesService.removeRole(userId, roleId);
  }

  /**
   * DELETE /user-roles/:userId/roles - Remove all roles from a user
   * Requires permission: 'user-roles:remove'
   */
  @Delete(':userId/roles')
  @Permissions('user_roles.remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAllRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.userRolesService.removeAllRoles(userId);
  }

  /**
   * GET /user-roles/:userId/roles - Get all roles assigned to a user
   * Requires permission: 'user-roles:read'
   */
  @Get(':userId/roles')
  @Permissions('user_roles.read')
  async getUserRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.userRolesService.getUserRoles(userId);
  }

  /**
   * GET /user-roles/:userId/permissions - Get all permissions for a user
   * Requires permission: 'user-roles:read'
   */
  @Get(':userId/permissions')
  @Permissions('user_roles.read')
  async getUserPermissions(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.userRolesService.getUserPermissions(userId);
  }

  /**
   * GET /user-roles/:roleId/users - Get all users with a specific role
   * Requires permission: 'user-roles:read'
   */
  @Get(':roleId/users')
  @Permissions('user_roles.read')
  async getRoleUsers(
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.userRolesService.getRoleUsers(roleId);
  }
}
