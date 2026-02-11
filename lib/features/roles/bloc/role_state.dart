import '../models/permission_model.dart';
import '../models/role_model.dart';

enum RoleStatus {
  initial,
  loading,
  loaded,
  submitting,
  error,
}

class RoleState {
  const RoleState({
    this.status = RoleStatus.initial,
    this.roles = const <RoleModel>[],
    this.permissions = const <PermissionModel>[],
    this.selectedRoleId,
    this.draftPermissionIds = const <String>[],
    this.errorMessage,
  });

  final RoleStatus status;
  final List<RoleModel> roles;
  final List<PermissionModel> permissions;
  final String? selectedRoleId;
  final List<String> draftPermissionIds;
  final String? errorMessage;

  RoleModel? get selectedRole {
    if (selectedRoleId == null) {
      return null;
    }
    for (final RoleModel role in roles) {
      if (role.id == selectedRoleId) {
        return role;
      }
    }
    return null;
  }

  RoleState copyWith({
    RoleStatus? status,
    List<RoleModel>? roles,
    List<PermissionModel>? permissions,
    String? selectedRoleId,
    bool clearSelectedRole = false,
    List<String>? draftPermissionIds,
    String? errorMessage,
    bool clearErrorMessage = false,
  }) {
    return RoleState(
      status: status ?? this.status,
      roles: roles ?? this.roles,
      permissions: permissions ?? this.permissions,
      selectedRoleId: clearSelectedRole ? null : (selectedRoleId ?? this.selectedRoleId),
      draftPermissionIds: draftPermissionIds ?? this.draftPermissionIds,
      errorMessage: clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
