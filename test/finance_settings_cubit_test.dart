import 'package:flutter_test/flutter_test.dart';

import '../lib/core/api/api_client.dart';
import '../lib/features/finance_settings/bloc/finance_settings_cubit.dart';
import '../lib/features/finance_settings/repository/finance_settings_repository.dart';

class _FakeFinanceSettingsRepository extends FinanceSettingsRepository {
  _FakeFinanceSettingsRepository() : super(apiClient: _NoopApiClient());

  int createAccountCalls = 0;
  int createPermissionCalls = 0;

  @override
  Future<List<FinanceAccountModel>> fetchAccounts() async {
    return const <FinanceAccountModel>[
      FinanceAccountModel(
        id: 'acc-1',
        code: '1000-CASH',
        name: 'Cash',
        accountType: 'asset',
        subType: 'current_asset',
        currency: 'USD',
        isActive: true,
      ),
    ];
  }

  @override
  Future<List<PeriodLockModel>> fetchPeriodLocks() async {
    return <PeriodLockModel>[
      PeriodLockModel(
        id: 'lock-1',
        startDate: DateTime(2026, 1, 1),
        endDate: DateTime(2026, 1, 31),
        isLocked: true,
        reason: 'Month end close',
      ),
    ];
  }

  @override
  Future<List<ManagedUserModel>> fetchUsers() async {
    return const <ManagedUserModel>[
      ManagedUserModel(
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
        status: 'active',
        roles: <String>['admin'],
        primaryRoleId: 'role-1',
      ),
    ];
  }

  @override
  Future<List<RoleOption>> fetchRoles() async {
    return const <RoleOption>[RoleOption(id: 'role-1', name: 'admin')];
  }

  @override
  Future<List<PermissionModel>> fetchPermissions() async {
    return const <PermissionModel>[
      PermissionModel(
        id: 'perm-1',
        module: 'reports',
        action: 'view',
        description: 'Can view reports',
      ),
    ];
  }

  @override
  Future<void> createAccount({
    required String code,
    required String name,
    required String accountType,
    String? subType,
    String currency = 'USD',
  }) async {
    createAccountCalls += 1;
  }

  @override
  Future<void> createPermission({
    required String module,
    required String action,
    String? description,
  }) async {
    createPermissionCalls += 1;
  }
}

class _NoopApiClient extends ApiClient {
  _NoopApiClient();
}

void main() {
  group('FinanceSettingsCubit', () {
    test('loadAll fetches settings datasets', () async {
      final _FakeFinanceSettingsRepository repository =
          _FakeFinanceSettingsRepository();
      final FinanceSettingsCubit cubit = FinanceSettingsCubit(
        repository: repository,
      );

      await cubit.loadAll();

      expect(cubit.state.accounts.length, 1);
      expect(cubit.state.periodLocks.length, 1);
      expect(cubit.state.users.length, 1);
      expect(cubit.state.roles.length, 1);
      expect(cubit.state.permissions.length, 1);
      await cubit.close();
    });

    test('createAccount validates required code and name', () async {
      final _FakeFinanceSettingsRepository repository =
          _FakeFinanceSettingsRepository();
      final FinanceSettingsCubit cubit = FinanceSettingsCubit(
        repository: repository,
      );

      await cubit.createAccount(code: '', name: '', accountType: 'asset');

      expect(cubit.state.errorMessage, 'Account code and name are required.');
      expect(repository.createAccountCalls, 0);
      await cubit.close();
    });

    test('updatePostingMapping modifies draft mapping', () async {
      final _FakeFinanceSettingsRepository repository =
          _FakeFinanceSettingsRepository();
      final FinanceSettingsCubit cubit = FinanceSettingsCubit(
        repository: repository,
      );

      cubit.updatePostingMapping('sales.invoice_issued', '4010-RETAIL-SALES');

      expect(
        cubit.state.postingMappings['sales.invoice_issued'],
        '4010-RETAIL-SALES',
      );
      await cubit.close();
    });

    test('savePostingMappingsSessionOnly sets feedback message', () async {
      final _FakeFinanceSettingsRepository repository =
          _FakeFinanceSettingsRepository();
      final FinanceSettingsCubit cubit = FinanceSettingsCubit(
        repository: repository,
      );

      cubit.savePostingMappingsSessionOnly();

      expect(
        cubit.state.successMessage,
        contains('Posting mapping draft saved'),
      );
      await cubit.close();
    });

    test('createPermission submits valid payload', () async {
      final _FakeFinanceSettingsRepository repository =
          _FakeFinanceSettingsRepository();
      final FinanceSettingsCubit cubit = FinanceSettingsCubit(
        repository: repository,
      );

      await cubit.createPermission(module: 'sales', action: 'approve');

      expect(repository.createPermissionCalls, 1);
      await cubit.close();
    });
  });
}
