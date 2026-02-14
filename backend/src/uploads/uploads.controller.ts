import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { LinkAttachmentDto } from './dto/link-attachment.dto';
import { SignedUrlQueryDto } from './dto/signed-url-query.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { UploadsService } from './uploads.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('attachments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('uploads.create')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  uploadAttachment(
    @UploadedFile() file: any,
    @Body() dto: UploadAttachmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.uploadsService.uploadAttachment(file, request.user.userId, dto);
  }

  @Get('attachments/:id/signed-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('uploads.read')
  getSignedUrl(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: SignedUrlQueryDto,
  ) {
    return this.uploadsService.createSignedUrl(id, query.expiresIn ?? 3600);
  }

  @Post('attachments/:id/link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permissions('uploads.update')
  linkAttachment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: LinkAttachmentDto,
  ) {
    return this.uploadsService.linkAttachment(id, dto);
  }

  @Get('download/:id')
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() response: Response,
  ) {
    const { attachment, absolutePath } = await this.uploadsService.resolveDownload(
      id,
      expires,
      signature,
    );

    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.originalName.replace(/"/g, '')}"`,
    );
    response.sendFile(absolutePath);
  }
}
