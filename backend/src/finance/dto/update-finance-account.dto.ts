import { PartialType } from '@nestjs/swagger';

import { CreateFinanceAccountDto } from './create-finance-account.dto';

export class UpdateFinanceAccountDto extends PartialType(CreateFinanceAccountDto) {}
