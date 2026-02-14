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
import { CreatePriceTierDto } from './dto/create-price-tier.dto';
import { SetProductTierPriceDto } from './dto/set-product-tier-price.dto';
import { UpdatePriceTierDto } from './dto/update-price-tier.dto';
import { PriceTiersService } from './price-tiers.service';

@Controller('price-tiers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PriceTiersController {
  constructor(private readonly priceTiersService: PriceTiersService) {}

  @Get()
  @Permissions('price_tiers.read')
  findAll() {
    return this.priceTiersService.findAll();
  }

  @Post()
  @Permissions('price_tiers.create')
  create(@Body() dto: CreatePriceTierDto) {
    return this.priceTiersService.create(dto);
  }

  @Get(':id')
  @Permissions('price_tiers.read')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.priceTiersService.findOne(id);
  }

  @Put(':id')
  @Permissions('price_tiers.update')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePriceTierDto,
  ) {
    return this.priceTiersService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('price_tiers.delete')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.priceTiersService.remove(id);
    return { message: 'Price tier deactivated successfully.' };
  }

  @Put(':tierId/products/:productId')
  @Permissions('price_tiers.update')
  setProductTierPrice(
    @Param('tierId', new ParseUUIDPipe()) tierId: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: SetProductTierPriceDto,
  ) {
    return this.priceTiersService.setProductTierPrice(tierId, productId, dto);
  }

  @Get(':tierId/products')
  @Permissions('price_tiers.read')
  getTierProducts(@Param('tierId', new ParseUUIDPipe()) tierId: string) {
    return this.priceTiersService.getTierProducts(tierId);
  }
}
