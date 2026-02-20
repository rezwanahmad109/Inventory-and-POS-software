import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../lib/app_routes.dart';
import '../lib/core/api/api_client.dart';
import '../lib/main.dart';
import '../lib/screens/inventory_list_screen.dart';

class FakeApiClient extends ApiClient {
  FakeApiClient();

  @override
  Future<void> setSession({
    required String accessToken,
    required String refreshToken,
  }) async {}

  @override
  Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    if (path == 'auth/login') {
      return <String, dynamic>{
        'accessToken': 'access-token',
        'refreshToken': 'refresh-token',
        'user': <String, dynamic>{
          'id': '550e8400-e29b-41d4-a716-446655440000',
          'roles': <String>['admin'],
          'permissions': <String>['inventory.read', 'sales.create'],
        },
      };
    }
    return <String, dynamic>{};
  }
}

void main() {
  testWidgets('shows validation errors on empty login fields', (
    WidgetTester tester,
  ) async {
    final fakeApiClient = FakeApiClient();
    await tester.pumpWidget(
      MaterialApp(home: LoginPage(apiClient: fakeApiClient)),
    );

    await tester.tap(find.text('Login'));
    await tester.pumpAndSettle();

    expect(find.text('Email is required'), findsOneWidget);
    expect(find.text('Password is required'), findsOneWidget);
  });

  testWidgets('logs in and navigates to inventory route', (
    WidgetTester tester,
  ) async {
    final fakeApiClient = FakeApiClient();
    await tester.pumpWidget(
      MaterialApp(
        routes: <String, WidgetBuilder>{
          AppRoutes.inventory: (_) => InventoryListScreen(apiClient: fakeApiClient),
        },
        home: LoginPage(apiClient: fakeApiClient),
      ),
    );

    await tester.enterText(find.byType(TextFormField).at(0), 'qa@example.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'StrongPass123!');
    await tester.tap(find.text('Login'));
    await tester.pumpAndSettle();

    expect(find.text('Inventory List'), findsOneWidget);
  });
}
