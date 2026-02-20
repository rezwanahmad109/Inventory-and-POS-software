import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { User } from '../database/entities/user.entity';
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
    const refreshTokenJti = randomUUID();
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.resolveRefreshTokenSecret(),
      expiresIn: this.resolveRefreshTokenExpiresIn(),
      jwtid: refreshTokenJti,
    });

    await this.usersService.storeRefreshToken(
      user.id,
      refreshToken,
      refreshTokenJti,
    );

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
    const { user } = await this.validateRefreshTokenOrThrow(refreshToken);

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
    const nextRefreshTokenJti = randomUUID();
    const nextRefreshToken = await this.jwtService.signAsync(nextPayload, {
      secret: this.resolveRefreshTokenSecret(),
      expiresIn: this.resolveRefreshTokenExpiresIn(),
      jwtid: nextRefreshTokenJti,
    });

    await this.usersService.storeRefreshToken(
      user.id,
      nextRefreshToken,
      nextRefreshTokenJti,
    );

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

  async revoke(refreshTokenDto: RefreshTokenDto): Promise<{ message: string }> {
    const refreshToken = refreshTokenDto.refreshToken.trim();
    const { user } = await this.validateRefreshTokenOrThrow(refreshToken);

    await this.usersService.storeRefreshToken(user.id, null, null);
    return { message: 'Refresh token revoked successfully.' };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.storeRefreshToken(userId, null, null);
    return { message: 'Logged out successfully.' };
  }

  private resolveAccessTokenSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret || secret.trim().length === 0) {
      throw new Error('JWT_SECRET is required.');
    }

    return secret.trim();
  }

  private resolveRefreshTokenSecret(): string {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret || refreshSecret.trim().length === 0) {
      throw new Error('JWT_REFRESH_SECRET is required.');
    }

    return refreshSecret.trim();
  }

  private resolveAccessTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '8h');
  }

  private resolveRefreshTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  private async validateRefreshTokenOrThrow(
    refreshToken: string,
  ): Promise<{ user: User; payload: JwtPayload }> {
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
    if (
      !user ||
      !user.isActive ||
      !user.refreshTokenHash ||
      !user.refreshTokenJtiHash
    ) {
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    const refreshTokenMatched = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );
    const refreshTokenJtiMatched =
      typeof payload.jti === 'string' &&
      payload.jti.trim().length > 0 &&
      (await bcrypt.compare(payload.jti, user.refreshTokenJtiHash));

    if (!refreshTokenMatched || !refreshTokenJtiMatched) {
      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    return { user, payload };
  }
}
