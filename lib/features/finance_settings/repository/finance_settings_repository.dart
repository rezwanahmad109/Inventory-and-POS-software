import '../../../core/api/api_client.dart';

class FinanceAccountModel {
  const FinanceAccountModel({
    required this.id,
    required this.code,
    required this.name,
    required this.accountType,
    required this.subType,
    required this.currency,
    required this.isActive,
  });

  final String id;
  final String code;
  final String name;
  final String accountType;
  final String? subType;
  final String currency;
  final bool isActive;
}

class PeriodLockModel {
  const PeriodLockModel({
    required this.id,
    required this.startDate,
    required this.endDate,
    required this.isLocked,
    required this.reason,
  });

  final String id;
  final DateTime? startDate;
  final DateTime? endDate;
  final bool isLocked;
  final String? reason;
}

class ManagedUserModel {
  const ManagedUserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.status,
    required this.roles,
    required this.primaryRoleId,
  });

  final String id;
  final String name;
  final String email;
  final String status;
  final List<String> roles;
  final String? primaryRoleId;
}

class RoleOption {
  const RoleOption({
    required this.id,
    required this.name,
  });

  final String id;
  final String name;
}

class PermissionModel {
  const PermissionModel({
    required this.id,
    required this.module,
    required this.action,
    required this.description,
  });

  final String id;
  final String module;
  final String action;
  final String? description;

  String get slug => action.contains('.') ? action : '$module.$action';
}

class FinanceSettingsRepository {
  FinanceSettingsRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<FinanceAccountModel>> fetchAccounts() async {
    final dynamic response = await _apiClient.get('api/accounts');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => FinanceAccountModel(
            id: row['id']?.toString() ?? '',
            code: row['code']?.toString() ?? '',
            name: row['name']?.toString() ?? '',
            accountType: row['accountType']?.toString() ?? '',
            subType: row['subType']?.toString(),
            currency: row['currency']?.toString() ?? 'USD',
            isActive: row['isActive'] != false,
          ),
        )
        .where((FinanceAccountModel row) => row.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> seedDefaultAccounts() async {
    await _apiClient.post('api/accounts/seed-default');
  }

  Future<void> createAccount({
    required String code,
    required String name,
    required String accountType,
    String? subType,
    String currency = 'USD',
  }) async {
    await _apiClient.post(
      'api/accounts',
      body: <String, dynamic>{
        'code': code.trim(),
        'name': name.trim(),
        'accountType': accountType,
        'currency': currency,
        if (subType != null && subType.trim().isNotEmpty) 'subType': subType.trim(),
      },
    );
  }

  Future<void> updateAccount({
    required String accountId,
    required String name,
    bool? isActive,
  }) async {
    await _apiClient.patch(
      'api/accounts/$accountId',
      body: <String, dynamic>{
        'name': name.trim(),
        if (isActive != null) 'isActive': isActive,
      },
    );
  }

  Future<void> deactivateAccount(String accountId) async {
    await _apiClient.delete('api/accounts/$accountId');
  }

  Future<List<PeriodLockModel>> fetchPeriodLocks() async {
    final dynamic response = await _apiClient.get('api/period-locks');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => PeriodLockModel(
            id: row['id']?.toString() ?? '',
            startDate: _toDate(row['startDate']),
            endDate: _toDate(row['endDate']),
            isLocked: row['isLocked'] == true,
            reason: row['reason']?.toString(),
          ),
        )
        .where((PeriodLockModel row) => row.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> lockPeriod({
    required DateTime startDate,
    required DateTime endDate,
    String? reason,
  }) async {
    await _apiClient.post(
      'api/period-locks',
      body: <String, dynamic>{
        'startDate': _toDateOnly(startDate),
        'endDate': _toDateOnly(endDate),
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
  }

  Future<void> unlockPeriod(String lockId) async {
    await _apiClient.post('api/period-locks/$lockId/unlock');
  }

  Future<List<ManagedUserModel>> fetchUsers() async {
    final dynamic response = await _apiClient.get('users');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => ManagedUserModel(
            id: row['id']?.toString() ?? '',
            name: row['name']?.toString() ?? '',
            email: row['email']?.toString() ?? '',
            status: row['status']?.toString() ?? '',
            roles: _extractRows(row['roles']).map((dynamic e) => e.toString()).toList(),
            primaryRoleId: row['primaryRoleId']?.toString(),
          ),
        )
        .where((ManagedUserModel row) => row.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> createUser({
    required String name,
    required String email,
    required String password,
    required String roleId,
  }) async {
    await _apiClient.post(
      'users',
      body: <String, dynamic>{
        'name': name.trim(),
        'email': email.trim(),
        'password': password,
        'roleId': roleId,
        'status': 'active',
      },
    );
  }

  Future<void> updateUserStatus({
    required String userId,
    required bool active,
  }) async {
    await _apiClient.patch(
      'users/$userId',
      body: <String, dynamic>{
        'status': active ? 'active' : 'inactive',
      },
    );
  }

  Future<void> assignUserRoles({
    required String userId,
    required List<String> roleIds,
    String? primaryRoleId,
  }) async {
    await _apiClient.put(
      'users/$userId/roles',
      body: <String, dynamic>{
        'roleIds': roleIds,
        if (primaryRoleId != null) 'primaryRoleId': primaryRoleId,
      },
    );
  }

  Future<List<RoleOption>> fetchRoles() async {
    final dynamic response = await _apiClient.get('roles');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => RoleOption(
            id: row['id']?.toString() ?? '',
            name: row['name']?.toString() ?? '',
          ),
        )
        .where((RoleOption role) => role.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<List<PermissionModel>> fetchPermissions() async {
    final dynamic response = await _apiClient.get('permissions');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => PermissionModel(
            id: row['id']?.toString() ?? '',
            module: row['module']?.toString() ?? '',
            action: row['action']?.toString() ?? '',
            description: row['description']?.toString(),
          ),
        )
        .where((PermissionModel permission) => permission.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> createPermission({
    required String module,
    required String action,
    String? description,
  }) async {
    await _apiClient.post(
      'permissions',
      body: <String, dynamic>{
        'module': module.trim(),
        'action': action.trim(),
        if (description != null && description.trim().isNotEmpty)
          'description': description.trim(),
      },
    );
  }

  Future<void> deletePermission(String permissionId) async {
    await _apiClient.delete('permissions/$permissionId');
  }

  List<dynamic> _extractRows(dynamic payload) {
    if (payload is List<dynamic>) {
      return payload;
    }
    if (payload is Map<String, dynamic>) {
      final dynamic rows = payload['items'] ?? payload['rows'] ?? payload['data'];
      if (rows is List<dynamic>) {
        return rows;
      }
    }
    return const <dynamic>[];
  }

  DateTime? _toDate(dynamic value) {
    final String raw = value?.toString() ?? '';
    if (raw.isEmpty) {
      return null;
    }
    return DateTime.tryParse(raw);
  }

  String _toDateOnly(DateTime value) {
    final DateTime normalized = DateTime(value.year, value.month, value.day);
    return normalized.toIso8601String().split('T').first;
  }
}
