import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';

import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { Role } from '../entities/role.entity';

interface PermissionDefinition {
  module: string;
  action: string;
  description: string;
}

interface RoleDefinition {
  name: string;
  description: string;
  isSystem: boolean;
  permissionSlugs: string[];
}

const PERMISSIONS: PermissionDefinition[] = [
  { module: 'dashboard', action: 'view', description: 'View dashboard summary' },
  { module: 'inventory', action: 'view', description: 'View inventory list' },
  { module: 'inventory', action: 'create', description: 'Create inventory item' },
  { module: 'inventory', action: 'update', description: 'Update inventory item' },
  { module: 'inventory', action: 'delete', description: 'Delete inventory item' },
  { module: 'inventory', action: 'adjust', description: 'Adjust inventory quantity' },
  { module: 'products', action: 'create', description: 'Create product' },
  { module: 'products', action: 'read', description: 'Read product' },
  { module: 'products', action: 'update', description: 'Update product' },
  { module: 'products', action: 'delete', description: 'Delete product' },
  { module: 'categories', action: 'create', description: 'Create category' },
  { module: 'categories', action: 'read', description: 'Read category' },
  { module: 'categories', action: 'update', description: 'Update category' },
  { module: 'categories', action: 'delete', description: 'Delete category' },
  { module: 'units', action: 'create', description: 'Create unit' },
  { module: 'units', action: 'read', description: 'Read unit' },
  { module: 'units', action: 'update', description: 'Update unit' },
  { module: 'units', action: 'delete', description: 'Delete unit' },
  { module: 'branches', action: 'create', description: 'Create branch' },
  { module: 'branches', action: 'read', description: 'Read branch' },
  { module: 'branches', action: 'update', description: 'Update branch' },
  { module: 'branches', action: 'delete', description: 'Delete branch' },
  {
    module: 'branch_products',
    action: 'read',
    description: 'Read branch product stock',
  },
  {
    module: 'branch_products',
    action: 'update',
    description: 'Update branch product stock',
  },
  {
    module: 'stock_transfers',
    action: 'create',
    description: 'Create stock transfer',
  },
  {
    module: 'stock_transfers',
    action: 'read',
    description: 'Read stock transfer history',
  },
  { module: 'customers', action: 'create', description: 'Create customer' },
  { module: 'customers', action: 'read', description: 'Read customer' },
  { module: 'customers', action: 'update', description: 'Update customer' },
  { module: 'customers', action: 'delete', description: 'Delete customer' },
  { module: 'suppliers', action: 'create', description: 'Create supplier' },
  { module: 'suppliers', action: 'read', description: 'Read supplier' },
  { module: 'suppliers', action: 'update', description: 'Update supplier' },
  { module: 'suppliers', action: 'delete', description: 'Delete supplier' },
  { module: 'purchases', action: 'create', description: 'Create purchase' },
  { module: 'purchases', action: 'read', description: 'Read purchase' },
  { module: 'purchases', action: 'update', description: 'Update purchase' },
  { module: 'purchases', action: 'delete', description: 'Delete purchase' },
  { module: 'purchase_returns', action: 'create', description: 'Create purchase return' },
  { module: 'purchase_returns', action: 'read', description: 'Read purchase return' },
  { module: 'sales', action: 'create', description: 'Create sale' },
  { module: 'sales', action: 'view', description: 'View sales' },
  { module: 'sales', action: 'update', description: 'Update sale' },
  { module: 'sales', action: 'delete', description: 'Delete sale' },
  { module: 'sales_returns', action: 'create', description: 'Create sales return' },
  { module: 'sales_returns', action: 'read', description: 'Read sales return' },
  { module: 'expenses', action: 'create', description: 'Create expense' },
  { module: 'expenses', action: 'read', description: 'Read expense' },
  { module: 'expenses', action: 'update', description: 'Update expense' },
  { module: 'expenses', action: 'delete', description: 'Delete expense' },
  { module: 'reports', action: 'view', description: 'View reports' },
  { module: 'reports', action: 'export', description: 'Export reports' },
  { module: 'settings', action: 'read', description: 'Read settings' },
  { module: 'settings', action: 'update', description: 'Update settings' },
  { module: 'audit_logs', action: 'read', description: 'Read audit logs' },
  { module: 'finance_accounts', action: 'read', description: 'Read chart of accounts' },
  { module: 'finance_accounts', action: 'seed', description: 'Seed chart of accounts' },
  { module: 'finance_invoices', action: 'create', description: 'Create finance invoice' },
  { module: 'finance_invoices', action: 'read', description: 'Read finance invoices' },
  { module: 'finance_payments', action: 'create', description: 'Create finance payment' },
  { module: 'finance_payments', action: 'read', description: 'Read finance payments' },
  { module: 'wallets', action: 'create', description: 'Create wallet' },
  { module: 'wallets', action: 'read', description: 'Read wallet' },
  { module: 'reconciliation', action: 'import', description: 'Import statements for reconciliation' },
  { module: 'reconciliation', action: 'read', description: 'Read reconciliation matches' },
  { module: 'reconciliation', action: 'match', description: 'Match reconciliations' },
  { module: 'finance_reports', action: 'read', description: 'Read finance reports' },
  { module: 'users', action: 'create', description: 'Create user' },
  { module: 'users', action: 'read', description: 'Read user' },
  { module: 'users', action: 'update', description: 'Update user' },
  { module: 'users', action: 'delete', description: 'Delete user' },
  { module: 'roles', action: 'create', description: 'Create role' },
  { module: 'roles', action: 'read', description: 'Read role' },
  { module: 'roles', action: 'update', description: 'Update role' },
  { module: 'roles', action: 'delete', description: 'Delete role' },
  { module: 'permissions', action: 'create', description: 'Create permission' },
  { module: 'permissions', action: 'read', description: 'Read permission' },
  { module: 'permissions', action: 'update', description: 'Update permission' },
  { module: 'permissions', action: 'delete', description: 'Delete permission' },
  { module: 'user_roles', action: 'read', description: 'Read user role assignments' },
  { module: 'user_roles', action: 'assign', description: 'Assign role to user' },
  { module: 'user_roles', action: 'remove', description: 'Remove role from user' },
];

const buildSlug = (module: string, action: string): string =>
  `${module}.${action}`;

const allPermissionSlugs = PERMISSIONS.map((permission) =>
  buildSlug(permission.module, permission.action),
);

const productPermissionSlugs = PERMISSIONS.filter(
  (permission) => permission.module === 'products',
).map((permission) => buildSlug(permission.module, permission.action));

const salesPermissionSlugs = PERMISSIONS.filter(
  (permission) => permission.module === 'sales',
).map((permission) => buildSlug(permission.module, permission.action));

const inventoryPermissionSlugs = PERMISSIONS.filter(
  (permission) => permission.module === 'inventory',
).map((permission) => buildSlug(permission.module, permission.action));

const customerPermissionSlugs = PERMISSIONS.filter(
  (permission) => permission.module === 'customers',
).map((permission) => buildSlug(permission.module, permission.action));

const branchPermissionSlugs = PERMISSIONS.filter(
  (permission) => permission.module === 'branches',
).map((permission) => buildSlug(permission.module, permission.action));

const branchProductPermissionSlugs = PERMISSIONS.filter(
  (permission) => permission.module === 'branch_products',
).map((permission) => buildSlug(permission.module, permission.action));

const stockTransferPermissionSlugs = PERMISSIONS.filter(
  (permission) => permission.module === 'stock_transfers',
).map((permission) => buildSlug(permission.module, permission.action));

const reportPermissionSlugs = PERMISSIONS.filter(
  (permission) => permission.module === 'reports',
).map((permission) => buildSlug(permission.module, permission.action));

const financePermissionSlugs = PERMISSIONS.filter((permission) =>
  permission.module.startsWith('finance_') ||
  permission.module === 'wallets' ||
  permission.module === 'reconciliation',
).map((permission) => buildSlug(permission.module, permission.action));

const dashboardPermissionSlugs = PERMISSIONS.filter(
  (permission) => permission.module === 'dashboard',
).map((permission) => buildSlug(permission.module, permission.action));

const auditPermissionSlugs = PERMISSIONS.filter(
  (permission) => permission.module === 'audit_logs',
).map((permission) => buildSlug(permission.module, permission.action));

const ROLES: RoleDefinition[] = [
  {
    name: 'super_admin',
    description: 'Full access to all modules and permission administration.',
    isSystem: true,
    permissionSlugs: allPermissionSlugs,
  },
  {
    name: 'admin',
    description: 'Administrative access controlled by super admin.',
    isSystem: true,
    permissionSlugs: allPermissionSlugs.filter(
      (slug) =>
        !slug.startsWith('permissions.create') &&
        !slug.startsWith('permissions.delete'),
    ),
  },
  {
    name: 'manager',
    description: 'Manager access for operations, sales, and reporting.',
    isSystem: true,
    permissionSlugs: [
      ...productPermissionSlugs,
      ...inventoryPermissionSlugs,
      ...salesPermissionSlugs,
      ...customerPermissionSlugs,
      ...branchPermissionSlugs,
      ...branchProductPermissionSlugs,
      ...stockTransferPermissionSlugs,
      ...reportPermissionSlugs,
      ...financePermissionSlugs,
      ...dashboardPermissionSlugs,
      'sales_returns.create',
      'sales_returns.read',
      'purchase_returns.create',
      'purchase_returns.read',
      'settings.read',
      ...auditPermissionSlugs,
    ],
  },
  {
    name: 'branch_manager',
    description: 'Branch-level operational control for stock and transfers.',
    isSystem: true,
    permissionSlugs: [
      'dashboard.view',
      'inventory.view',
      'inventory.update',
      'inventory.adjust',
      'products.read',
      'products.update',
      'branches.read',
      'branches.update',
      'branch_products.read',
      'branch_products.update',
      'stock_transfers.create',
      'stock_transfers.read',
      'sales.view',
      'reports.view',
      'reports.export',
      'settings.read',
      ...auditPermissionSlugs,
    ],
  },
  {
    name: 'stock_admin',
    description: 'Inventory-focused role for stock operations across branches.',
    isSystem: true,
    permissionSlugs: [
      'dashboard.view',
      'inventory.view',
      'inventory.create',
      'inventory.update',
      'inventory.delete',
      'inventory.adjust',
      'products.read',
      'products.update',
      'branches.read',
      'branch_products.read',
      'branch_products.update',
      'stock_transfers.create',
      'stock_transfers.read',
      'reports.view',
      'reports.export',
      'settings.read',
      ...auditPermissionSlugs,
    ],
  },
  {
    name: 'cashier',
    description: 'Cashier access focused on sales and customer lookups.',
    isSystem: true,
    permissionSlugs: [
      'sales.create',
      'sales.view',
      'sales_returns.create',
      'sales_returns.read',
      'purchase_returns.create',
      'purchase_returns.read',
      'products.read',
      'customers.read',
      'customers.create',
      'branches.read',
      'branch_products.read',
      'inventory.view',
      'dashboard.view',
      'settings.read',
      'finance_invoices.create',
      'finance_invoices.read',
      'finance_payments.create',
      'finance_payments.read',
      'wallets.read',
      'reconciliation.read',
      'finance_reports.read',
    ],
  },
  {
    name: 'viewer',
    description: 'Read-only role for dashboards and reports.',
    isSystem: true,
    permissionSlugs: [
      'dashboard.view',
      'inventory.view',
      'reports.view',
      'products.read',
      'branches.read',
      'branch_products.read',
      'customers.read',
      'suppliers.read',
      'settings.read',
    ],
  },
];

export async function runSeed(
  permissionsRepository: Repository<Permission>,
  rolesRepository: Repository<Role>,
  rolePermissionsRepository: Repository<RolePermission>,
): Promise<void> {
  const logger = new Logger('PermissionSeed');
  logger.log('Starting permission seed...');

  const seededPermissions = await seedPermissions(permissionsRepository, logger);
  const seededRoles = await seedRoles(rolesRepository, logger);
  await seedRolePermissions(
    rolePermissionsRepository,
    seededRoles,
    seededPermissions,
    logger,
  );

  logger.log('Permission seed completed.');
}

async function seedPermissions(
  permissionsRepository: Repository<Permission>,
  logger: Logger,
): Promise<Map<string, Permission>> {
  const permissionMap = new Map<string, Permission>();

  for (const permissionDef of PERMISSIONS) {
    const slug = buildSlug(permissionDef.module, permissionDef.action);
    let permission = await permissionsRepository.findOne({
      where: { slug },
    });

    if (!permission) {
      permission = permissionsRepository.create({
        module: permissionDef.module,
        action: permissionDef.action,
        slug,
        description: permissionDef.description,
      });
      permission = await permissionsRepository.save(permission);
      logger.log(`Created permission "${slug}".`);
    }

    permissionMap.set(slug, permission);
  }

  return permissionMap;
}

async function seedRoles(
  rolesRepository: Repository<Role>,
  logger: Logger,
): Promise<Map<string, Role>> {
  const roleMap = new Map<string, Role>();

  for (const roleDef of ROLES) {
    let role = await rolesRepository.findOne({
      where: { name: roleDef.name },
    });

    if (!role) {
      role = rolesRepository.create({
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      });
    } else {
      role.description = roleDef.description;
      role.isSystem = roleDef.isSystem;
    }

    role = await rolesRepository.save(role);
    roleMap.set(roleDef.name, role);
    logger.log(`Ensured role "${roleDef.name}".`);
  }

  return roleMap;
}

async function seedRolePermissions(
  rolePermissionsRepository: Repository<RolePermission>,
  seededRoles: Map<string, Role>,
  seededPermissions: Map<string, Permission>,
  logger: Logger,
): Promise<void> {
  for (const roleDef of ROLES) {
    const role = seededRoles.get(roleDef.name);
    if (!role) {
      logger.warn(`Skipping permission assignment for missing role "${roleDef.name}".`);
      continue;
    }

    const existingAssignments = await rolePermissionsRepository.find({
      where: { roleId: role.id },
    });
    const assignedPermissionIds = new Set<string>(
      existingAssignments.map((assignment) => assignment.permissionId),
    );

    for (const permissionSlug of roleDef.permissionSlugs) {
      const permission = seededPermissions.get(permissionSlug);
      if (!permission) {
        logger.warn(`Skipping missing permission "${permissionSlug}".`);
        continue;
      }

      if (assignedPermissionIds.has(permission.id)) {
        continue;
      }

      const rolePermission = rolePermissionsRepository.create({
        roleId: role.id,
        permissionId: permission.id,
      });
      await rolePermissionsRepository.save(rolePermission);
      logger.log(`Assigned "${permissionSlug}" to role "${roleDef.name}".`);
    }
  }
}
