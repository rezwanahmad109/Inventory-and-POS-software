import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

import '../lib/core/api/api_client.dart';
import '../lib/features/auth/bloc/auth_bloc.dart';
import '../lib/features/auth/bloc/auth_event.dart';
import '../lib/screens/inventory_list_screen.dart';

class _FakeInventoryApiClient extends ApiClient {
  _FakeInventoryApiClient();

  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path == 'health') {
      return <String, dynamic>{'status': 'ok'};
    }

    if (path == 'products' || path == 'products/search') {
      return <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'prod-1',
          'sku': 'SKU-1',
          'name': 'Thermal Printer',
          'category': 'Hardware',
          'price': 199.0,
          'stockQty': 12,
          'lowStockThreshold': 3,
        },
      ];
    }

    return <dynamic>[];
  }
}

void main() {
  testWidgets('drawer shows operations links for permitted user', (
    WidgetTester tester,
  ) async {
    final _FakeInventoryApiClient apiClient = _FakeInventoryApiClient();
    final AuthBloc authBloc = AuthBloc()
      ..add(
        const AuthSessionSet(
          userId: 'user-1',
          roles: <String>['admin'],
          userPermissions: <String>[
            'roles.read',
            'sales.view',
            'purchases.read',
            'warehouses.read',
            'reports.view',
            'users.read',
            'sales_returns.create',
            'purchase_returns.create',
          ],
        ),
      );

    await tester.pumpWidget(
      MaterialApp(
        home: BlocProvider<AuthBloc>.value(
          value: authBloc,
          child: InventoryListScreen(apiClient: apiClient),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Open navigation menu'));
    await tester.pumpAndSettle();

    expect(find.text('Sales Operations'), findsOneWidget);
    expect(find.text('Purchase Operations'), findsOneWidget);
    expect(find.text('Warehouse Operations'), findsOneWidget);
    expect(find.text('Reporting Dashboard'), findsOneWidget);
    expect(find.text('Finance Settings'), findsOneWidget);
    expect(find.text('User Access'), findsOneWidget);

    await authBloc.close();
  });

  testWidgets('drawer hides operations links when user lacks permission', (
    WidgetTester tester,
  ) async {
    final _FakeInventoryApiClient apiClient = _FakeInventoryApiClient();
    final AuthBloc authBloc = AuthBloc()
      ..add(
        const AuthSessionSet(
          userId: 'user-2',
          roles: <String>['cashier'],
          userPermissions: <String>['inventory.read'],
        ),
      );

    await tester.pumpWidget(
      MaterialApp(
        home: BlocProvider<AuthBloc>.value(
          value: authBloc,
          child: InventoryListScreen(apiClient: apiClient),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Open navigation menu'));
    await tester.pumpAndSettle();

    expect(find.text('Sales Operations'), findsNothing);
    expect(find.text('Purchase Operations'), findsNothing);
    expect(find.text('Warehouse Operations'), findsNothing);
    expect(find.text('Reporting Dashboard'), findsNothing);
    expect(find.text('Finance Settings'), findsNothing);
    expect(find.text('User Access'), findsNothing);

    await authBloc.close();
  });
}
