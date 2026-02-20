import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Permission } from './entities/permission.entity';
import { Unit } from './entities/product.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Setting } from './entities/setting.entity';
import { TaxEntity } from './entities/tax.entity';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { DatabaseBootstrapService } from './database-bootstrap.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Permission,
      Role,
      RolePermission,
      User,
      UserRole,
      Unit,
      TaxEntity,
      Setting,
    ]),
  ],
  providers: [DatabaseBootstrapService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
