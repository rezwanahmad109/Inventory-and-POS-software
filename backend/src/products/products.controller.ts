import {
  Body,
  Controller,
  Header,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { ImportProductsCsvDto } from './dto/import-products-csv.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Permissions('products.create')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @Permissions('products.read')
  @ApiOperation({ summary: 'List all products' })
  findAll(@Query() query: ProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('search')
  @Permissions('products.read')
  @ApiOperation({
    summary: 'Search products by SKU, barcode, or name with ranking',
  })
  search(@Query() query: SearchProductsDto) {
    return this.productsService.search(query.q, query.limit);
  }

  @Get('by-barcode/:barcode')
  @Permissions('products.read')
  @ApiOperation({ summary: 'Get product by exact barcode match' })
  findByBarcode(@Param('barcode') barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }

  @Get('low-stock')
  @Permissions('products.read')
  @ApiOperation({ summary: 'List low-stock products' })
  findLowStock() {
    return this.productsService.findLowStockProducts();
  }

  @Get('export/csv')
  @Header('Content-Type', 'text/csv')
  @Permissions('products.read')
  @ApiOperation({ summary: 'Export products as CSV text' })
  async exportCsv(@Query() query: ProductsQueryDto) {
    return this.productsService.exportCsv(query);
  }

  @Post('import/csv')
  @Permissions('products.create')
  @ApiOperation({ summary: 'Import products from CSV payload' })
  importCsv(@Body() dto: ImportProductsCsvDto) {
    return this.productsService.importCsv(dto.csvContent);
  }

  @Get(':id')
  @Permissions('products.read')
  @ApiOperation({ summary: 'Get product by id' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @Permissions('products.update')
  @ApiOperation({ summary: 'Update product' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Post(':id/stock-adjustments')
  @Permissions('inventory.adjust')
  @ApiOperation({
    summary:
      'Adjust stock quantity with reason code and create stock/audit ledger entries',
  })
  adjustStock(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: StockAdjustmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.productsService.adjustStock(id, dto, request.user.userId);
  }

  @Delete(':id')
  @Permissions('products.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete product' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.productsService.remove(id);
    return { message: 'Product deleted successfully.' };
  }
}
