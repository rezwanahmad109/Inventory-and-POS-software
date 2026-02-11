enum AuthStatus {
  unauthenticated,
  authenticated,
}

class AuthState {
  const AuthState({
    required this.status,
    this.userId,
    this.roles = const <String>[],
    this.userPermissions = const <String>[],
  });

  final AuthStatus status;
  final String? userId;
  final List<String> roles;
  final List<String> userPermissions;

  const AuthState.unauthenticated()
      : status = AuthStatus.unauthenticated,
        userId = null,
        roles = const <String>[],
        userPermissions = const <String>[];

  AuthState copyWith({
    AuthStatus? status,
    String? userId,
    List<String>? roles,
    List<String>? userPermissions,
  }) {
    return AuthState(
      status: status ?? this.status,
      userId: userId ?? this.userId,
      roles: roles ?? this.roles,
      userPermissions: userPermissions ?? this.userPermissions,
    );
  }

  bool hasPermission(String permission) {
    final String normalizedRequiredPermission = _normalizePermission(permission);
    return userPermissions
        .map(_normalizePermission)
        .contains(normalizedRequiredPermission);
  }

  static String _normalizePermission(String permission) {
    return permission.toLowerCase().trim().replaceAll(':', '.');
  }
}
