import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { RequestUser } from '../../common/interfaces/request-user.interface';
import { UserAccessProfile, UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const configuredSecret = configService.get<string>('JWT_SECRET');
    const nodeEnv = configService.get<string>('NODE_ENV', 'development');
    if (!configuredSecret && nodeEnv === 'production') {
      throw new Error('JWT_SECRET must be set in production.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configuredSecret ??
        'development-only-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    let accessProfile: UserAccessProfile;
    try {
      accessProfile = await this.usersService.getUserAccessProfile(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    if (!accessProfile.user.isActive) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    return {
      userId: accessProfile.user.id,
      email: accessProfile.user.email,
      role: accessProfile.primaryRole,
      roles: accessProfile.roles,
      permissions: accessProfile.permissions,
    };
  }
}
