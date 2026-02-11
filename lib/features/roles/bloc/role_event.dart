abstract class RoleEvent {
  const RoleEvent();
}

class RoleLoadRequested extends RoleEvent {
  const RoleLoadRequested({this.preferredRoleId});

  final String? preferredRoleId;
}

class RoleCreateRequested extends RoleEvent {
  const RoleCreateRequested(this.name);

  final String name;
}

class RoleSelected extends RoleEvent {
  const RoleSelected(this.roleId);

  final String roleId;
}

class RolePermissionToggled extends RoleEvent {
  const RolePermissionToggled({
    required this.permissionId,
    required this.enabled,
  });

  final String permissionId;
  final bool enabled;
}

class RolePermissionsSaveRequested extends RoleEvent {
  const RolePermissionsSaveRequested();
}
