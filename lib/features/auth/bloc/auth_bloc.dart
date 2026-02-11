import 'package:flutter_bloc/flutter_bloc.dart';

import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc() : super(const AuthState.unauthenticated()) {
    on<AuthSessionSet>(_onSessionSet);
    on<AuthLoggedOut>(_onLoggedOut);
  }

  void _onSessionSet(
    AuthSessionSet event,
    Emitter<AuthState> emit,
  ) {
    emit(
      AuthState(
        status: AuthStatus.authenticated,
        userId: event.userId,
        roles: event.roles,
        userPermissions: event.userPermissions,
      ),
    );
  }

  void _onLoggedOut(
    AuthLoggedOut event,
    Emitter<AuthState> emit,
  ) {
    emit(const AuthState.unauthenticated());
  }
}
