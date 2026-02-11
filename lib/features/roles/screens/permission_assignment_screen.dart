import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/role_bloc.dart';
import '../bloc/role_event.dart';
import '../bloc/role_state.dart';
import '../models/permission_model.dart';
import '../models/role_model.dart';
import '../widgets/permission_group_widget.dart';

class PermissionAssignmentScreen extends StatefulWidget {
  const PermissionAssignmentScreen({
    super.key,
    required this.role,
  });

  final RoleModel role;

  @override
  State<PermissionAssignmentScreen> createState() =>
      _PermissionAssignmentScreenState();
}

class _PermissionAssignmentScreenState extends State<PermissionAssignmentScreen> {
  bool _pendingSaveFeedback = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RoleBloc>().add(RoleSelected(widget.role.id));
    });
  }

  Map<String, List<PermissionModel>> _groupByModule(
    List<PermissionModel> permissions,
  ) {
    final Map<String, List<PermissionModel>> groupedPermissions =
        <String, List<PermissionModel>>{};
    for (final PermissionModel permission in permissions) {
      final List<PermissionModel> modulePermissions =
          groupedPermissions.putIfAbsent(
        permission.module,
        () => <PermissionModel>[],
      );
      modulePermissions.add(permission);
    }
    for (final List<PermissionModel> modulePermissions
        in groupedPermissions.values) {
      modulePermissions.sort(
        (PermissionModel a, PermissionModel b) => a.action.compareTo(b.action),
      );
    }
    return groupedPermissions;
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<RoleBloc, RoleState>(
      listenWhen: (RoleState previous, RoleState current) =>
          previous.status != current.status,
      listener: (BuildContext context, RoleState state) {
        if (state.status == RoleStatus.error && state.errorMessage != null) {
          _pendingSaveFeedback = false;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.errorMessage!)),
          );
        }
        if (state.status == RoleStatus.loaded && _pendingSaveFeedback) {
          _pendingSaveFeedback = false;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Permissions saved successfully.')),
          );
        }
      },
      builder: (BuildContext context, RoleState state) {
        final bool loading = state.status == RoleStatus.loading ||
            state.status == RoleStatus.submitting;
        final Set<String> selectedPermissionIds =
            state.draftPermissionIds.toSet();
        final Map<String, List<PermissionModel>> groupedPermissions =
            _groupByModule(state.permissions);
        final List<String> modules = groupedPermissions.keys.toList()
          ..sort((String a, String b) => a.compareTo(b));

        return Scaffold(
          appBar: AppBar(
            title: Text('Assign Permissions - ${widget.role.name}'),
          ),
          body: loading && state.permissions.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: <Widget>[
                        Expanded(
                          child: modules.isEmpty
                              ? const Center(
                                  child: Text('No permissions available.'),
                                )
                              : ListView.builder(
                                  itemCount: modules.length,
                                  itemBuilder: (BuildContext context, int index) {
                                    final String module = modules[index];
                                    return PermissionGroupWidget(
                                      module: module,
                                      permissions:
                                          groupedPermissions[module] ?? <PermissionModel>[],
                                      selectedPermissionIds: selectedPermissionIds,
                                      onPermissionChanged: (
                                        PermissionModel permission,
                                        bool enabled,
                                      ) {
                                        context.read<RoleBloc>().add(
                                              RolePermissionToggled(
                                                permissionId: permission.id,
                                                enabled: enabled,
                                              ),
                                            );
                                      },
                                    );
                                  },
                                ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: loading || state.selectedRoleId == null
                                ? null
                                : () {
                                    _pendingSaveFeedback = true;
                                    context.read<RoleBloc>().add(
                                          const RolePermissionsSaveRequested(),
                                        );
                                  },
                            child: Text(
                              loading ? 'Saving...' : 'Save Permissions',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        );
      },
    );
  }
}
