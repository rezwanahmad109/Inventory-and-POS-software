import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UsersService } from '../users/users.service';

interface AuthenticatedUserDto {
  id: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  permissions: string[];
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  refreshExpiresIn: string;
  user: AuthenticatedUserDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthTokenResponse> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatched = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const accessProfile = await this.usersService.getUserAccessProfile(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: accessProfile.primaryRole,
      roles: accessProfile.roles,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.resolveAccessTokenSecret(),
      expiresIn: this.resolveAccessTokenExpiresIn(),
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.resolveRefreshTokenSecret(),
      expiresIn: this.resolveRefreshTokenExpiresIn(),
    });

    await this.usersService.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.resolveAccessTokenExpiresIn(),
      refreshExpiresIn: this.resolveRefreshTokenExpiresIn(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: accessProfile.primaryRole,
        roles: accessProfile.roles,
        permissions: accessProfile.permissions,
      },
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto): Promise<AuthTokenResponse> {
    const refreshToken = refreshTokenDto.refreshToken.trim();
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.resolveRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.usersService.findForRefreshValidation(payload.sub);
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    const refreshTokenMatched = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );
    if (!refreshTokenMatched) {
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    const accessProfile = await this.usersService.getUserAccessProfile(user.id);
    const nextPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: accessProfile.primaryRole,
      roles: accessProfile.roles,
    };

    const nextAccessToken = await this.jwtService.signAsync(nextPayload, {
      secret: this.resolveAccessTokenSecret(),
      expiresIn: this.resolveAccessTokenExpiresIn(),
    });
    const nextRefreshToken = await this.jwtService.signAsync(nextPayload, {
      secret: this.resolveRefreshTokenSecret(),
      expiresIn: this.resolveRefreshTokenExpiresIn(),
    });

    await this.usersService.storeRefreshToken(user.id, nextRefreshToken);

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresIn: this.resolveAccessTokenExpiresIn(),
      refreshExpiresIn: this.resolveRefreshTokenExpiresIn(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: accessProfile.primaryRole,
        roles: accessProfile.roles,
        permissions: accessProfile.permissions,
      },
    };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.storeRefreshToken(userId, null);
    return { message: 'Logged out successfully.' };
  }

  private resolveAccessTokenSecret(): string {
    return this.configService.get<string>(
      'JWT_SECRET',
      'development-only-secret-change-in-production',
    );
  }

  private resolveRefreshTokenSecret(): string {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (refreshSecret && refreshSecret.trim().length > 0) {
      return refreshSecret.trim();
    }

    return this.resolveAccessTokenSecret();
  }

  private resolveAccessTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '8h');
  }

  private resolveRefreshTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }
}
