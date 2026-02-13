import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ImportStatementDto } from './dto/import-statement.dto';
import { ReconcileMatchDto } from './dto/reconcile-match.dto';
import { ReconcileService } from './services/reconcile.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/reconcile')
export class ReconcileController {
  constructor(private readonly reconcileService: ReconcileService) {}

  // Example import payload:
  // {
  //   "walletId": "uuid",
  //   "statementRef": "BANK-2026-02-13",
  //   "lines": [{ "txnDate": "2026-02-10", "amount": -100.25, "description": "POS settlement" }]
  // }
  @Post('statements/import')
  @Permissions('reconciliation.import')
  @ApiOperation({ summary: 'Import statement lines for reconciliation' })
  importStatement(
    @Body() dto: ImportStatementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reconcileService.importStatement(dto, request.user.userId);
  }

  @Get('statements/:statementId/suggestions')
  @Permissions('reconciliation.read')
  @ApiOperation({ summary: 'Suggest statement-to-ledger matches' })
  suggestMatches(@Param('statementId', new ParseUUIDPipe()) statementId: string) {
    return this.reconcileService.suggestMatches(statementId);
  }

  @Post('match')
  @Permissions('reconciliation.match')
  @ApiOperation({ summary: 'Confirm a reconciliation match' })
  match(
    @Body() dto: ReconcileMatchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reconcileService.match(dto, request.user.userId);
  }
}
