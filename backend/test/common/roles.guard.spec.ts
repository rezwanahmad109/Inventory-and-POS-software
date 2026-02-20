import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../../src/common/decorators/permissions.decorator';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';
import { RoleName } from '../../src/common/enums/role-name.enum';
import { RolesGuard } from '../../src/common/guards/roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const createContext = (user: {
    userId: string;
    email: string;
    role: string;
    roles?: string[];
    permissions?: string[];
  }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows super admin even when permission metadata is present', () => {
    reflector.getAllAndOverride = jest.fn((key: string) => {
      if (key === PERMISSIONS_KEY) {
        return ['products.delete'];
      }
      if (key === ROLES_KEY) {
        return [RoleName.ADMIN];
      }
      return undefined;
    });

    const guard = new RolesGuard(reflector);
    const canActivate = guard.canActivate(
      createContext({
        userId: '1',
        email: 'sa@example.com',
        role: 'super_admin',
        roles: ['super_admin'],
        permissions: [],
      }),
    );

    expect(canActivate).toBe(true);
  });

  it('blocks request when required permission is missing', () => {
    reflector.getAllAndOverride = jest.fn((key: string) => {
      if (key === PERMISSIONS_KEY) {
        return ['products.update'];
      }
      return undefined;
    });

    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(
        createContext({
          userId: '2',
          email: 'staff@example.com',
          role: 'staff',
          roles: ['staff'],
          permissions: ['products.read'],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks request when required role is missing', () => {
    reflector.getAllAndOverride = jest.fn((key: string) => {
      if (key === ROLES_KEY) {
        return [RoleName.ADMIN];
      }
      return undefined;
    });

    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(
        createContext({
          userId: '3',
          email: 'cashier@example.com',
          role: 'cashier',
          roles: ['cashier'],
          permissions: [],
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
