import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { BranchProductDto } from './dto/branch-product.dto';
import { ApproveStockTransferDto } from './dto/approve-stock-transfer.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { ReceiveStockTransferDto } from './dto/receive-stock-transfer.dto';
import { StockTransferDto } from './dto/stock-transfer.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchesService } from './branches.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '../common/enums/role-name.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('branches')
  @Permissions('branches.read')
  @ApiOperation({ summary: 'List all branches' })
  findAllBranches() {
    return this.branchesService.findAllBranches();
  }

  @Post('branches')
  @Permissions('branches.create')
  @ApiOperation({ summary: 'Create branch' })
  @ApiResponse({ status: 201, description: 'Branch created' })
  createBranch(@Body() createBranchDto: CreateBranchDto) {
    return this.branchesService.createBranch(createBranchDto);
  }

  @Put('branches/:id')
  @Permissions('branches.update')
  @ApiOperation({ summary: 'Update branch details' })
  updateBranch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateBranchDto: UpdateBranchDto,
  ) {
    return this.branchesService.updateBranch(id, updateBranchDto);
  }

  @Delete('branches/:id')
  @Permissions('branches.delete')
  @ApiOperation({ summary: 'Delete/deactivate branch' })
  async removeBranch(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await this.branchesService.removeBranch(id);
    return result.mode === 'deactivated'
      ? {
          message:
            'Branch has stock and was deactivated (isActive=false) instead of being soft deleted.',
        }
      : { message: 'Branch soft deleted successfully.' };
  }

  @Get('branch-products/:branchId')
  @Permissions('branch_products.read')
  @ApiOperation({ summary: 'Get all products and stock rows for a branch' })
  findBranchProducts(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
  ) {
    return this.branchesService.getBranchProducts(branchId);
  }

  @Patch('branch-products/:branchId/:productId')
  @Permissions('branch_products.update')
  @Roles(
    RoleName.ADMIN,
    RoleName.MANAGER,
    RoleName.BRANCH_MANAGER,
    RoleName.STOCK_ADMIN,
    RoleName.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Update branch-specific stock for one product' })
  updateBranchProduct(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() branchProductDto: BranchProductDto,
  ) {
    return this.branchesService.updateBranchProductStock(
      branchId,
      productId,
      branchProductDto,
    );
  }

  @Get('branches/low-stock')
  @Permissions('branch_products.read')
  @ApiOperation({ summary: 'List low-stock products across all branches' })
  getLowStockAcrossBranches() {
    return this.branchesService.getLowStockAcrossBranches();
  }

  @Get('warehouses/stock-levels')
  @Permissions('branch_products.read')
  @ApiOperation({
    summary: 'Get product stock levels across all warehouses (or by warehouse)',
  })
  getWarehouseStockLevels(@Query('branchId') branchId?: string) {
    return this.branchesService.getWarehouseStockLevels(branchId);
  }

  @Post('stock-transfers')
  @Permissions('stock_transfers.create')
  @Roles(
    RoleName.ADMIN,
    RoleName.MANAGER,
    RoleName.BRANCH_MANAGER,
    RoleName.STOCK_ADMIN,
    RoleName.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Create stock transfer request' })
  @ApiResponse({ status: 201, description: 'Stock transfer created' })
  createStockTransfer(
    @Body() stockTransferDto: StockTransferDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.branchesService.initiateStockTransfer(
      stockTransferDto,
      request.user.userId,
    );
  }

  @Post('stock-transfers/:id/approve')
  @Permissions('stock_transfers.approve')
  @Roles(
    RoleName.ADMIN,
    RoleName.MANAGER,
    RoleName.BRANCH_MANAGER,
    RoleName.STOCK_ADMIN,
    RoleName.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Approve stock transfer (deduct from source warehouse)' })
  approveStockTransfer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveStockTransferDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.branchesService.approveStockTransfer(id, request.user.userId, dto.note);
  }

  @Post('stock-transfers/:id/receive')
  @Permissions('stock_transfers.receive')
  @Roles(
    RoleName.ADMIN,
    RoleName.MANAGER,
    RoleName.BRANCH_MANAGER,
    RoleName.STOCK_ADMIN,
    RoleName.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Receive stock transfer (add to destination warehouse)' })
  receiveStockTransfer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReceiveStockTransferDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.branchesService.receiveStockTransfer(id, request.user.userId, dto.note);
  }

  @Get('stock-transfers')
  @Permissions('stock_transfers.read')
  @ApiOperation({ summary: 'Get stock transfer history' })
  getStockTransfers() {
    return this.branchesService.getStockTransferHistory();
  }
}
