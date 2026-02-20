import * as bcrypt from 'bcrypt';

import { AuthService } from '../../src/auth/auth.service';
import { JwtPayload } from '../../src/auth/interfaces/jwt-payload.interface';
import { UsersService } from '../../src/users/users.service';

describe('AuthService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    getUserAccessProfile: jest.fn(),
    storeRefreshToken: jest.fn(),
    findForRefreshValidation: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      const map: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_EXPIRES_IN: '8h',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return map[key] ?? fallback;
    }),
  };

  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(
      usersService,
      jwtService as any,
      configService as any,
    );
  });

  it('returns access and refresh token on login', async () => {
    const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      password: passwordHash,
      isActive: true,
    } as any);
    usersService.getUserAccessProfile.mockResolvedValue({
      user: { id: 'user-1' } as any,
      roles: ['admin'],
      permissions: ['products.read'],
      primaryRole: 'admin',
    });
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token-1')
      .mockResolvedValueOnce('refresh-token-1');

    const result = await authService.login({
      email: 'admin@example.com',
      password: 'ChangeMe123!',
    });

    expect(result.accessToken).toBe('access-token-1');
    expect(result.refreshToken).toBe('refresh-token-1');
    expect(usersService.storeRefreshToken).toHaveBeenCalledWith(
      'user-1',
      'refresh-token-1',
      expect.any(String),
    );
  });

  it('rotates refresh token and issues new access token', async () => {
    const payload: JwtPayload = {
      sub: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
      roles: ['admin'],
      jti: 'refresh-jti-1',
    };

    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);
    const refreshTokenHash = await bcrypt.hash('refresh-token-old', 12);
    const refreshTokenJtiHash = await bcrypt.hash('refresh-jti-1', 12);
    usersService.findForRefreshValidation.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      isActive: true,
      refreshTokenHash,
      refreshTokenJtiHash,
    } as any);
    usersService.getUserAccessProfile.mockResolvedValue({
      user: { id: 'user-1' } as any,
      roles: ['admin'],
      permissions: ['products.read'],
      primaryRole: 'admin',
    });
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token-2')
      .mockResolvedValueOnce('refresh-token-2');

    const result = await authService.refresh({
      refreshToken: 'refresh-token-old',
    });

    expect(result.accessToken).toBe('access-token-2');
    expect(result.refreshToken).toBe('refresh-token-2');
    expect(usersService.storeRefreshToken).toHaveBeenCalledWith(
      'user-1',
      'refresh-token-2',
      expect.any(String),
    );
  });

  it('revokes refresh token on logout', async () => {
    const response = await authService.logout('user-1');

    expect(usersService.storeRefreshToken).toHaveBeenCalledWith(
      'user-1',
      null,
      null,
    );
    expect(response.message).toBe('Logged out successfully.');
  });

  it('revokes refresh token by token value', async () => {
    const payload: JwtPayload = {
      sub: 'user-1',
      email: 'admin@example.com',
      role: 'admin',
      roles: ['admin'],
      jti: 'refresh-jti-2',
    };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);
    usersService.findForRefreshValidation.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      isActive: true,
      refreshTokenHash: await bcrypt.hash('refresh-token-old', 12),
      refreshTokenJtiHash: await bcrypt.hash('refresh-jti-2', 12),
    } as any);

    const response = await authService.revoke({
      refreshToken: 'refresh-token-old',
    });

    expect(response.message).toBe('Refresh token revoked successfully.');
    expect(usersService.storeRefreshToken).toHaveBeenCalledWith(
      'user-1',
      null,
      null,
    );
  });
});
