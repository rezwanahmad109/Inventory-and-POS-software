abstract class AuthEvent {
  const AuthEvent();
}

class AuthSessionSet extends AuthEvent {
  const AuthSessionSet({
    required this.userId,
    required this.roles,
    required this.userPermissions,
  });

  final String userId;
  final List<String> roles;
  final List<String> userPermissions;
}

class AuthLoggedOut extends AuthEvent {
  const AuthLoggedOut();
}
