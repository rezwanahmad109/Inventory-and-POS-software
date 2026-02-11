import '../../../core/api/api_client.dart';
import '../models/permission_model.dart';
import '../models/role_model.dart';

class RoleRepository {
  RoleRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  List<dynamic> _extractRows(dynamic payload) {
    if (payload is List<dynamic>) {
      return payload;
    }
    if (payload is Map<String, dynamic>) {
      final dynamic rows = payload['data'] ?? payload['items'] ?? payload['results'];
      if (rows is List<dynamic>) {
        return rows;
      }
      if (payload['permissions'] is List<dynamic>) {
        return payload['permissions'] as List<dynamic>;
      }
    }
    return <dynamic>[];
  }

  Future<List<RoleModel>> fetchRoles() async {
    final dynamic response = await _apiClient.get('roles');
    final List<RoleModel> roles = _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(RoleModel.fromJson)
        .toList(growable: false);

    return roles;
  }

  Future<RoleModel> createRole(String name) async {
    final String normalizedName = name.trim().toLowerCase();
    final dynamic response = await _apiClient.post(
      'roles',
      body: <String, dynamic>{'name': normalizedName},
    );
    if (response is Map<String, dynamic>) {
      return RoleModel.fromJson(response);
    }

    throw const ApiException(500, 'Unexpected role creation response format.');
  }

  Future<List<PermissionModel>> fetchPermissions() async {
    final dynamic response = await _apiClient.get('permissions');
    final List<PermissionModel> permissions = _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(PermissionModel.fromJson)
        .toList(growable: false);

    return permissions;
  }

  Future<List<PermissionModel>> fetchRolePermissions(String roleId) async {
    final dynamic response = await _apiClient.get('roles/$roleId/permissions');
    final List<PermissionModel> permissions = _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(PermissionModel.fromJson)
        .toList(growable: false);

    return permissions;
  }

  Future<void> assignPermissions({
    required String roleId,
    required List<String> permissionIds,
  }) async {
    await _apiClient.post(
      'roles/$roleId/permissions',
      body: <String, dynamic>{
        'roleId': roleId,
        'permissionIds': permissionIds,
      },
    );
  }
}
