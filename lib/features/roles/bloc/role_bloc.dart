import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../models/permission_model.dart';
import '../models/role_model.dart';
import '../repository/role_repository.dart';
import 'role_event.dart';
import 'role_state.dart';

class RoleBloc extends Bloc<RoleEvent, RoleState> {
  RoleBloc({required RoleRepository repository})
      : _repository = repository,
        super(const RoleState()) {
    on<RoleLoadRequested>(_onRoleLoadRequested);
    on<RoleCreateRequested>(_onRoleCreateRequested);
    on<RoleSelected>(_onRoleSelected);
    on<RolePermissionToggled>(_onRolePermissionToggled);
    on<RolePermissionsSaveRequested>(_onRolePermissionsSaveRequested);
  }

  final RoleRepository _repository;

  Future<void> _onRoleLoadRequested(
    RoleLoadRequested event,
    Emitter<RoleState> emit,
  ) async {
    emit(
      state.copyWith(
        status: RoleStatus.loading,
        clearErrorMessage: true,
      ),
    );

    try {
      final List<dynamic> result = await Future.wait<dynamic>(<Future<dynamic>>[
        _repository.fetchRoles(),
        _repository.fetchPermissions(),
      ]);

      final List<RoleModel> roles = (result[0] as List<RoleModel>)
        ..sort((RoleModel a, RoleModel b) => a.name.compareTo(b.name));
      final List<PermissionModel> permissions = (result[1] as List<PermissionModel>)
        ..sort((PermissionModel a, PermissionModel b) {
          final int moduleCompare = a.module.compareTo(b.module);
          if (moduleCompare != 0) {
            return moduleCompare;
          }
          return a.action.compareTo(b.action);
        });

      final String? selectedRoleId = event.preferredRoleId ??
          state.selectedRoleId ??
          (roles.isNotEmpty ? roles.first.id : null);

      List<String> selectedPermissionIds = <String>[];
      if (selectedRoleId != null && selectedRoleId.isNotEmpty) {
        selectedPermissionIds = await _fetchSelectedRolePermissionIds(selectedRoleId);
      }

      emit(
        state.copyWith(
          status: RoleStatus.loaded,
          roles: roles,
          permissions: permissions,
          selectedRoleId: selectedRoleId,
          draftPermissionIds: selectedPermissionIds,
          clearErrorMessage: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          status: RoleStatus.error,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  Future<void> _onRoleCreateRequested(
    RoleCreateRequested event,
    Emitter<RoleState> emit,
  ) async {
    emit(
      state.copyWith(
        status: RoleStatus.submitting,
        clearErrorMessage: true,
      ),
    );

    try {
      final RoleModel role = await _repository.createRole(event.name.trim());
      add(RoleLoadRequested(preferredRoleId: role.id));
    } catch (error) {
      emit(
        state.copyWith(
          status: RoleStatus.error,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  Future<void> _onRoleSelected(
    RoleSelected event,
    Emitter<RoleState> emit,
  ) async {
    emit(
      state.copyWith(
        status: RoleStatus.loading,
        selectedRoleId: event.roleId,
        clearErrorMessage: true,
      ),
    );

    try {
      final List<String> selectedPermissionIds =
          await _fetchSelectedRolePermissionIds(event.roleId);
      emit(
        state.copyWith(
          status: RoleStatus.loaded,
          selectedRoleId: event.roleId,
          draftPermissionIds: selectedPermissionIds,
          clearErrorMessage: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          status: RoleStatus.error,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  void _onRolePermissionToggled(
    RolePermissionToggled event,
    Emitter<RoleState> emit,
  ) {
    final Set<String> selectedPermissionIds =
        state.draftPermissionIds.toSet();
    if (event.enabled) {
      selectedPermissionIds.add(event.permissionId);
    } else {
      selectedPermissionIds.remove(event.permissionId);
    }

    emit(
      state.copyWith(
        draftPermissionIds: selectedPermissionIds.toList(growable: false),
      ),
    );
  }

  Future<void> _onRolePermissionsSaveRequested(
    RolePermissionsSaveRequested event,
    Emitter<RoleState> emit,
  ) async {
    final String? selectedRoleId = state.selectedRoleId;
    if (selectedRoleId == null || selectedRoleId.isEmpty) {
      return;
    }

    emit(
      state.copyWith(
        status: RoleStatus.submitting,
        clearErrorMessage: true,
      ),
    );

    try {
      await _repository.assignPermissions(
        roleId: selectedRoleId,
        permissionIds: state.draftPermissionIds,
      );
      emit(
        state.copyWith(
          status: RoleStatus.loaded,
          clearErrorMessage: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          status: RoleStatus.error,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  Future<List<String>> _fetchSelectedRolePermissionIds(String roleId) async {
    final List<PermissionModel> permissions =
        await _repository.fetchRolePermissions(roleId);
    return permissions
        .map((PermissionModel permission) => permission.id)
        .toSet()
        .toList(growable: false);
  }
}
