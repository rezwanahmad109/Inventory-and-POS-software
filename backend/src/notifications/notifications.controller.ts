import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UsePipes,
  ValidationPipe,
  Put,
  UseGuards,
} from '@nestjs/common';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('templates')
  @Permissions('notifications.read')
  findTemplates() {
    return this.notificationsService.findTemplates();
  }

  @Post('templates')
  @Permissions('notifications.create')
  createTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.notificationsService.createTemplate(dto);
  }

  @Put('templates/:id')
  @Permissions('notifications.update')
  updateTemplate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.notificationsService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @Permissions('notifications.delete')
  async removeTemplate(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.notificationsService.removeTemplate(id);
    return { message: 'Email template deleted successfully.' };
  }

  @Post('send')
  @Permissions('notifications.send')
  send(@Body() dto: SendNotificationDto) {
    return this.notificationsService.sendNotification(dto);
  }
}
