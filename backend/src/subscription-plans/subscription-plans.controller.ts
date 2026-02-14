import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { SubscriptionPlansService } from './subscription-plans.service';

@Controller('subscription-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Get()
  @Permissions('subscription_plans.read')
  findAll() {
    return this.subscriptionPlansService.findAll();
  }

  @Post()
  @Permissions('subscription_plans.create')
  create(@Body() dto: CreateSubscriptionPlanDto) {
    return this.subscriptionPlansService.create(dto);
  }

  @Get(':id')
  @Permissions('subscription_plans.read')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.subscriptionPlansService.findOne(id);
  }

  @Put(':id')
  @Permissions('subscription_plans.update')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionPlansService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('subscription_plans.delete')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.subscriptionPlansService.remove(id);
    return { message: 'Subscription plan deleted successfully.' };
  }
}
