import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/role_bloc.dart';
import '../bloc/role_event.dart';
import '../bloc/role_state.dart';
import '../models/role_model.dart';
import '../widgets/create_role_dialog.dart';
import '../widgets/role_list_tile.dart';
import 'permission_assignment_screen.dart';

class RoleManagementScreen extends StatefulWidget {
  const RoleManagementScreen({super.key});

  @override
  State<RoleManagementScreen> createState() => _RoleManagementScreenState();
}

class _RoleManagementScreenState extends State<RoleManagementScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RoleBloc>().add(const RoleLoadRequested());
    });
  }

  Future<void> _openCreateRoleDialog() async {
    final String? roleName = await showDialog<String>(
      context: context,
      builder: (BuildContext context) => const CreateRoleDialog(),
    );

    if (!mounted || roleName == null || roleName.trim().isEmpty) {
      return;
    }

    context.read<RoleBloc>().add(RoleCreateRequested(roleName));
  }

  void _openPermissionAssignment(RoleModel role) {
    context.read<RoleBloc>().add(RoleSelected(role.id));
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PermissionAssignmentScreen(role: role),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<RoleBloc, RoleState>(
      listener: (BuildContext context, RoleState state) {
        if (state.status == RoleStatus.error && state.errorMessage != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.errorMessage!)),
          );
        }
      },
      builder: (BuildContext context, RoleState state) {
        final bool loading = state.status == RoleStatus.loading ||
            state.status == RoleStatus.submitting;

        return Scaffold(
          appBar: AppBar(
            title: const Text('Role Management'),
          ),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: state.selectedRoleId,
                          decoration: const InputDecoration(
                            labelText: 'Role',
                          ),
                          hint: const Text('Select role'),
                          items: state.roles
                              .map(
                                (RoleModel role) => DropdownMenuItem<String>(
                                  value: role.id,
                                  child: Text(role.name),
                                ),
                              )
                              .toList(growable: false),
                          onChanged: loading
                              ? null
                              : (String? roleId) {
                                  if (roleId == null) {
                                    return;
                                  }
                                  context.read<RoleBloc>().add(RoleSelected(roleId));
                                },
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        tooltip: 'Create role',
                        onPressed: loading ? null : _openCreateRoleDialog,
                        icon: const Icon(Icons.add),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: loading && state.roles.isEmpty
                        ? const Center(child: CircularProgressIndicator())
                        : state.roles.isEmpty
                            ? const Center(child: Text('No roles available.'))
                            : ListView.builder(
                                itemCount: state.roles.length,
                                itemBuilder: (BuildContext context, int index) {
                                  final RoleModel role = state.roles[index];
                                  return RoleListTile(
                                    role: role,
                                    selected: role.id == state.selectedRoleId,
                                    onTap: () => _openPermissionAssignment(role),
                                  );
                                },
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
