import 'package:flutter_bloc/flutter_bloc.dart';

import '../repository/finance_settings_repository.dart';
import 'finance_settings_state.dart';

class FinanceSettingsCubit extends Cubit<FinanceSettingsState> {
  FinanceSettingsCubit({required FinanceSettingsRepository repository})
      : _repository = repository,
        super(FinanceSettingsState.initial());

  final FinanceSettingsRepository _repository;

  Future<void> loadAll() async {
    emit(state.copyWith(isLoading: true, errorMessage: null, successMessage: null));
    try {
      final List<dynamic> result = await Future.wait<dynamic>(<Future<dynamic>>[
        _repository.fetchAccounts(),
        _repository.fetchPeriodLocks(),
        _repository.fetchUsers(),
        _repository.fetchRoles(),
        _repository.fetchPermissions(),
      ]);
      emit(
        state.copyWith(
          isLoading: false,
          accounts: result[0] as List<FinanceAccountModel>,
          periodLocks: result[1] as List<PeriodLockModel>,
          users: result[2] as List<ManagedUserModel>,
          roles: result[3] as List<RoleOption>,
          permissions: result[4] as List<PermissionModel>,
        ),
      );
    } on Exception catch (error) {
      emit(state.copyWith(isLoading: false, errorMessage: error.toString()));
    }
  }

  Future<void> seedDefaultAccounts() async {
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.seedDefaultAccounts();
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Default chart of accounts seeded.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> createAccount({
    required String code,
    required String name,
    required String accountType,
    String? subType,
    String currency = 'USD',
  }) async {
    if (code.trim().isEmpty || name.trim().isEmpty) {
      emit(state.copyWith(errorMessage: 'Account code and name are required.'));
      return;
    }
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.createAccount(
        code: code,
        name: name,
        accountType: accountType,
        subType: subType,
        currency: currency,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Account created.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> lockPeriod({
    required DateTime startDate,
    required DateTime endDate,
    String? reason,
  }) async {
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.lockPeriod(
        startDate: startDate,
        endDate: endDate,
        reason: reason,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Accounting period locked.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> unlockPeriod(String periodId) async {
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.unlockPeriod(periodId);
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Accounting period unlocked.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> createUser({
    required String name,
    required String email,
    required String password,
    required String roleId,
  }) async {
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.createUser(
        name: name,
        email: email,
        password: password,
        roleId: roleId,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'User created.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> assignUserRoles({
    required String userId,
    required List<String> roleIds,
    String? primaryRoleId,
  }) async {
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.assignUserRoles(
        userId: userId,
        roleIds: roleIds,
        primaryRoleId: primaryRoleId,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'User roles updated.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> createPermission({
    required String module,
    required String action,
    String? description,
  }) async {
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.createPermission(
        module: module,
        action: action,
        description: description,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Permission created.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> deletePermission(String permissionId) async {
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.deletePermission(permissionId);
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Permission removed.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  void updatePostingMapping(String eventType, String accountCode) {
    final Map<String, String> next = Map<String, String>.from(state.postingMappings);
    next[eventType] = accountCode;
    emit(state.copyWith(postingMappings: next));
  }

  void savePostingMappingsSessionOnly() {
    emit(
      state.copyWith(
        successMessage:
            'Posting mapping draft saved in this session. Backend currently uses account-code conventions for posting.',
      ),
    );
  }

  void clearFeedback() {
    emit(state.copyWith(errorMessage: null, successMessage: null));
  }
}
