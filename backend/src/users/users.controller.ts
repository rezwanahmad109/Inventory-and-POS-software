import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ImportUsersDto } from './dto/import-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  @Permissions('users.read')
  @ApiOperation({ summary: 'List all users (admin management)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async findAll() {
    return this.usersService.findAllManagedUsers();
  }

  @Get('users/:id')
  @Permissions('users.read')
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findManagedUserById(id);
  }

  @Post('users')
  @Permissions('users.create')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async create(
    @Body() createUserDto: CreateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.createManagedUser(createUserDto, request.user.userId);
  }

  @Post('users/import')
  @Permissions('users.create')
  @ApiOperation({ summary: 'Bulk import users' })
  async importUsers(
    @Body() importUsersDto: ImportUsersDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.importUsers(importUsersDto, request.user.userId);
  }

  @Patch('users/:id')
  @Permissions('users.update')
  @ApiOperation({ summary: 'Update user profile, status, password, or primary role' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.updateManagedUser(id, updateUserDto, request.user.userId);
  }

  @Put('users/:id/roles')
  @Permissions('user_roles.assign')
  @ApiOperation({ summary: 'Replace user role assignments' })
  @ApiResponse({ status: 200, description: 'User roles updated successfully' })
  async assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignUserRolesDto: AssignUserRolesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.assignRolesToUser(
      id,
      assignUserRolesDto,
      request.user.userId,
    );
  }

  @Delete('users/:id')
  @Permissions('users.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user account' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete own account' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.usersService.removeManagedUser(id, request.user.userId);
  }

  @Get(['me/permissions', 'users/me/permissions'])
  @ApiOperation({ summary: 'Get current user role and permission slugs' })
  @ApiResponse({ status: 200, description: 'Current user permission list' })
  async getMyPermissions(@Req() request: AuthenticatedRequest) {
    const accessProfile = await this.usersService.getUserAccessProfile(
      request.user.userId,
    );

    return {
      userId: accessProfile.user.id,
      email: accessProfile.user.email,
      role: accessProfile.primaryRole,
      roles: accessProfile.roles,
      permissions: accessProfile.permissions,
    };
  }
}
