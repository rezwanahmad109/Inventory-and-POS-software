import { PartialType } from '@nestjs/swagger';

import { CreatePosOrderDto } from './create-pos-order.dto';

export class UpdatePosOrderDto extends PartialType(CreatePosOrderDto) {}
