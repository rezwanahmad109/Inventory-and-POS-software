import 'package:flutter/material.dart';

import '../models/permission_model.dart';

class PermissionGroupWidget extends StatelessWidget {
  const PermissionGroupWidget({
    super.key,
    required this.module,
    required this.permissions,
    required this.selectedPermissionIds,
    required this.onPermissionChanged,
  });

  final String module;
  final List<PermissionModel> permissions;
  final Set<String> selectedPermissionIds;
  final void Function(PermissionModel permission, bool enabled) onPermissionChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              module.toUpperCase(),
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 6),
            ...permissions.map((PermissionModel permission) {
              final bool selected = selectedPermissionIds.contains(permission.id);
              return CheckboxListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                value: selected,
                onChanged: (bool? value) {
                  onPermissionChanged(permission, value ?? false);
                },
                title: Text(permission.action),
                subtitle: permission.description == null
                    ? null
                    : Text(permission.description!),
              );
            }),
          ],
        ),
      ),
    );
  }
}
