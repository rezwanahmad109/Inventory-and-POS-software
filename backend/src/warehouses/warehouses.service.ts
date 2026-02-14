import { Injectable } from '@nestjs/common';

import { BranchProductView, BranchesService } from '../branches/branches.service';
import { CreateBranchDto } from '../branches/dto/create-branch.dto';
import { UpdateBranchDto } from '../branches/dto/update-branch.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly branchesService: BranchesService) {}

  findAll() {
    return this.branchesService.findAllBranches();
  }

  create(dto: CreateBranchDto) {
    return this.branchesService.createBranch(dto);
  }

  update(id: string, dto: UpdateBranchDto) {
    return this.branchesService.updateBranch(id, dto);
  }

  remove(id: string) {
    return this.branchesService.removeBranch(id);
  }

  getStockLevels(warehouseId?: string) {
    return this.branchesService.getWarehouseStockLevels(warehouseId);
  }

  getLowStock(): Promise<BranchProductView[]> {
    return this.branchesService.getLowStockAcrossBranches();
  }
}
