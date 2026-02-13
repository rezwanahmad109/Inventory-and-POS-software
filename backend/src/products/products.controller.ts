import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
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

  @Delete(':id')
  @Permissions('products.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete product' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.productsService.remove(id);
    return { message: 'Product deleted successfully.' };
  }
}
