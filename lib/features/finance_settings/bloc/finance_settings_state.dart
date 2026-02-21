import '../repository/finance_settings_repository.dart';

const Object _financeUnset = Object();

class FinanceSettingsState {
  const FinanceSettingsState({
    required this.isLoading,
    required this.isSubmitting,
    required this.accounts,
    required this.periodLocks,
    required this.users,
    required this.roles,
    required this.permissions,
    required this.postingMappings,
    this.errorMessage,
    this.successMessage,
  });

  factory FinanceSettingsState.initial() {
    return const FinanceSettingsState(
      isLoading: false,
      isSubmitting: false,
      accounts: <FinanceAccountModel>[],
      periodLocks: <PeriodLockModel>[],
      users: <ManagedUserModel>[],
      roles: <RoleOption>[],
      permissions: <PermissionModel>[],
      postingMappings: <String, String>{
        'sales.invoice_issued': '4000-SALES',
        'sales.payment_received': '1000-CASH',
        'purchase.billed': '1200-INVENTORY',
        'purchase.payment_sent': '2100-AP',
      },
      errorMessage: null,
      successMessage: null,
    );
  }

  final bool isLoading;
  final bool isSubmitting;
  final List<FinanceAccountModel> accounts;
  final List<PeriodLockModel> periodLocks;
  final List<ManagedUserModel> users;
  final List<RoleOption> roles;
  final List<PermissionModel> permissions;
  final Map<String, String> postingMappings;
  final String? errorMessage;
  final String? successMessage;

  FinanceSettingsState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    List<FinanceAccountModel>? accounts,
    List<PeriodLockModel>? periodLocks,
    List<ManagedUserModel>? users,
    List<RoleOption>? roles,
    List<PermissionModel>? permissions,
    Map<String, String>? postingMappings,
    Object? errorMessage = _financeUnset,
    Object? successMessage = _financeUnset,
  }) {
    return FinanceSettingsState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      accounts: accounts ?? this.accounts,
      periodLocks: periodLocks ?? this.periodLocks,
      users: users ?? this.users,
      roles: roles ?? this.roles,
      permissions: permissions ?? this.permissions,
      postingMappings: postingMappings ?? this.postingMappings,
      errorMessage: errorMessage == _financeUnset
          ? this.errorMessage
          : errorMessage as String?,
      successMessage: successMessage == _financeUnset
          ? this.successMessage
          : successMessage as String?,
    );
  }
}
