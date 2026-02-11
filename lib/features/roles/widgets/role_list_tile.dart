import 'package:flutter/material.dart';

import '../models/role_model.dart';

class RoleListTile extends StatelessWidget {
  const RoleListTile({
    super.key,
    required this.role,
    required this.selected,
    required this.onTap,
  });

  final RoleModel role;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        selected: selected,
        onTap: onTap,
        title: Text(role.name),
        subtitle: role.description == null || role.description!.isEmpty
            ? null
            : Text(role.description!),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (role.isSystem)
              const Padding(
                padding: EdgeInsets.only(right: 8),
                child: Chip(label: Text('System')),
              ),
            const Icon(Icons.edit_outlined),
          ],
        ),
      ),
    );
  }
}
