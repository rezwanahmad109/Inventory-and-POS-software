import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../../src/common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../src/common/guards/permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const createContext = (user: {
    userId: string;
    email: string;
    role: string;
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

  it('allows request when user has all required permissions', () => {
    reflector.getAllAndOverride = jest.fn((key: string) => {
      if (key === PERMISSIONS_KEY) {
        return ['products.read', 'products.update'];
      }
      return undefined;
    });

    const guard = new PermissionsGuard(reflector);
    const canActivate = guard.canActivate(
      createContext({
        userId: '1',
        email: 'manager@example.com',
        role: 'manager',
        permissions: ['products.read', 'products.update'],
      }),
    );

    expect(canActivate).toBe(true);
  });

  it('blocks request when any required permission is missing', () => {
    reflector.getAllAndOverride = jest.fn((key: string) => {
      if (key === PERMISSIONS_KEY) {
        return ['products.delete'];
      }
      return undefined;
    });

    const guard = new PermissionsGuard(reflector);

    expect(() =>
      guard.canActivate(
        createContext({
          userId: '2',
          email: 'staff@example.com',
          role: 'staff',
          permissions: ['products.read'],
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
