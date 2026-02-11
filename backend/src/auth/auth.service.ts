import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      roles: string[];
      permissions: string[];
    };
  }> {
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

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '8h'),
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
}
