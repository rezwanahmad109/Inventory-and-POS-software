import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { LockPeriodDto } from './dto/lock-period.dto';
import { PeriodLockService } from './services/period-lock.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Finance Period Locks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/period-locks')
export class PeriodLocksController {
  constructor(private readonly periodLockService: PeriodLockService) {}

  @Post()
  @Permissions('finance_period_locks.lock')
  @ApiOperation({ summary: 'Lock an accounting period' })
  lockPeriod(
    @Body() dto: LockPeriodDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.periodLockService.lockPeriod(dto, request.user.userId);
  }

  @Post(':id/unlock')
  @Permissions('finance_period_locks.lock')
  @ApiOperation({ summary: 'Unlock a previously locked accounting period' })
  unlockPeriod(@Param('id') id: string) {
    return this.periodLockService.unlockPeriod(id);
  }

  @Get()
  @Permissions('finance_period_locks.read')
  @ApiOperation({ summary: 'List accounting period lock windows' })
  list() {
    return this.periodLockService.list();
  }
}
