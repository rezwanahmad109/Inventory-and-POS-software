import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app_routes.dart';
import 'core/api/api_client.dart';
import 'features/auth/bloc/auth_bloc.dart';
import 'features/auth/bloc/auth_event.dart';
import 'features/auth/bloc/auth_state.dart';
import 'features/finance_settings/screens/finance_settings_screen.dart';
import 'features/purchase_operations/screens/purchase_operations_screen.dart';
import 'features/reporting_dashboard/screens/reporting_dashboard_screen.dart';
import 'features/roles/bloc/role_bloc.dart';
import 'features/roles/repository/role_repository.dart';
import 'features/roles/screens/role_management_screen.dart';
import 'features/sales_operations/screens/sales_operations_screen.dart';
import 'features/warehouse_operations/screens/warehouse_operations_screen.dart';
import 'screens/admin_settings_screen.dart';
import 'screens/checkout_screen.dart';
import 'screens/inventory_list_screen.dart';
import 'screens/purchase_return_screen.dart';
import 'screens/sales_history_screen.dart';
import 'screens/sales_return_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  final String buildEnv = const String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'dev',
  ).trim().toLowerCase();
  final List<String> dotenvCandidates = <String>['.env.$buildEnv', '.env'];
  for (final String file in dotenvCandidates) {
    try {
      await dotenv.load(fileName: file);
      break;
    } catch (_) {
      // Try next candidate; compile-time --dart-define values are still supported.
    }
  }
  runApp(const InventoryPosApp());
}

class InventoryPosApp extends StatelessWidget {
  const InventoryPosApp({super.key});

  static const Color _primaryBlue = Color(0xFF1F4FFF);
  static const Color _accentGold = Color(0xFFD4AF37);
  static final ApiClient _apiClient = ApiClient();
  static final RoleRepository _roleRepository = RoleRepository(
    apiClient: _apiClient,
  );

  @override
  Widget build(BuildContext context) {
    final ColorScheme lightScheme =
        ColorScheme.fromSeed(
          seedColor: _primaryBlue,
          brightness: Brightness.light,
        ).copyWith(
          primary: _primaryBlue,
          secondary: _accentGold,
          surface: Colors.white,
        );
    final ColorScheme darkScheme =
        ColorScheme.fromSeed(
          seedColor: _primaryBlue,
          brightness: Brightness.dark,
        ).copyWith(
          primary: const Color(0xFF90A8FF),
          secondary: const Color(0xFFF0D784),
        );

    return MultiBlocProvider(
      providers: <BlocProvider<dynamic>>[
        BlocProvider<AuthBloc>(create: (_) => AuthBloc()),
        BlocProvider<RoleBloc>(
          create: (_) => RoleBloc(repository: _roleRepository),
        ),
      ],
      child: MaterialApp(
        title: 'Inventory & POS',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: lightScheme,
          scaffoldBackgroundColor: Colors.white,
          appBarTheme: const AppBarTheme(
            backgroundColor: Colors.white,
            foregroundColor: _primaryBlue,
            surfaceTintColor: Colors.white,
          ),
          inputDecorationTheme: InputDecorationTheme(
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFCFD8DC)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _primaryBlue, width: 1.4),
            ),
            filled: true,
            fillColor: Colors.white,
          ),
        ),
        darkTheme: ThemeData(
          useMaterial3: true,
          colorScheme: darkScheme,
          inputDecorationTheme: InputDecorationTheme(
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        themeMode: ThemeMode.system,
        initialRoute: AppRoutes.login,
        routes: <String, WidgetBuilder>{
          AppRoutes.login: (BuildContext context) =>
              LoginPage(apiClient: _apiClient),
          AppRoutes.inventory: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  return InventoryListScreen(apiClient: _apiClient);
                },
              ),
          AppRoutes.cartCheckout: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  return const CheckoutScreen();
                },
              ),
          AppRoutes.salesHistory: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  return SalesHistoryScreen(apiClient: _apiClient);
                },
              ),
          AppRoutes.salesReturn: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  if (!authState.hasPermission('sales_returns.create')) {
                    return const _AccessDeniedPage(title: 'Sales Return');
                  }
                  return SalesReturnScreen(apiClient: _apiClient);
                },
              ),
          AppRoutes.purchaseReturn: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  if (!authState.hasPermission('purchase_returns.create')) {
                    return const _AccessDeniedPage(title: 'Purchase Return');
                  }
                  return PurchaseReturnScreen(apiClient: _apiClient);
                },
              ),
          AppRoutes.settings: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  if (!authState.hasAnyRole(const <String>[
                    'admin',
                    'super_admin',
                  ])) {
                    return const _AccessDeniedPage(title: 'Settings');
                  }
                  return AdminSettingsScreen(apiClient: _apiClient);
                },
              ),
          AppRoutes.roles: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  if (!authState.hasPermission('roles.read')) {
                    return const _AccessDeniedPage(title: 'Role Management');
                  }
                  return const RoleManagementScreen();
                },
              ),
          AppRoutes.salesOps: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  if (!authState.hasPermission('sales.view')) {
                    return const _AccessDeniedPage(title: 'Sales Operations');
                  }
                  return SalesOperationsScreen(apiClient: _apiClient);
                },
              ),
          AppRoutes.purchaseOps: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  if (!authState.hasPermission('purchases.read')) {
                    return const _AccessDeniedPage(
                      title: 'Purchase Operations',
                    );
                  }
                  return PurchaseOperationsScreen(apiClient: _apiClient);
                },
              ),
          AppRoutes.warehouseOps: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  if (!authState.hasPermission('warehouses.read')) {
                    return const _AccessDeniedPage(
                      title: 'Warehouse Operations',
                    );
                  }
                  return WarehouseOperationsScreen(apiClient: _apiClient);
                },
              ),
          AppRoutes.reportingDashboard: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  if (!authState.hasPermission('reports.view') &&
                      !authState.hasPermission('dashboard.view')) {
                    return const _AccessDeniedPage(
                      title: 'Reporting Dashboard',
                    );
                  }
                  return ReportingDashboardScreen(apiClient: _apiClient);
                },
              ),
          AppRoutes.financeSettings: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  if (!authState.hasAnyRole(const <String>[
                    'admin',
                    'super_admin',
                  ])) {
                    return const _AccessDeniedPage(title: 'Finance Settings');
                  }
                  return FinanceSettingsScreen(apiClient: _apiClient);
                },
              ),
          AppRoutes.userAccess: (BuildContext context) =>
              BlocBuilder<AuthBloc, AuthState>(
                builder: (BuildContext context, AuthState authState) {
                  if (authState.status != AuthStatus.authenticated) {
                    return LoginPage(apiClient: _apiClient);
                  }
                  if (!authState.hasPermission('users.read') &&
                      !authState.hasPermission('roles.read')) {
                    return const _AccessDeniedPage(title: 'User Access');
                  }
                  return FinanceSettingsScreen(
                    apiClient: _apiClient,
                    initialTabIndex: 2,
                  );
                },
              ),
        },
        onGenerateRoute: (RouteSettings settings) {
          if (settings.name == AppRoutes.productDetails) {
            final Product? product = settings.arguments is Product
                ? settings.arguments as Product
                : null;
            return MaterialPageRoute<void>(
              builder: (BuildContext context) =>
                  ProductDetailsPage(product: product),
            );
          }
          return null;
        },
        onUnknownRoute: (_) => MaterialPageRoute<void>(
          builder: (BuildContext context) => LoginPage(apiClient: _apiClient),
        ),
      ),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({required this.apiClient, super.key});

  final ApiClient apiClient;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _rememberMe = true;
  bool _loading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
    });

    try {
      final dynamic response = await widget.apiClient.post(
        'auth/login',
        body: <String, dynamic>{
          'email': _emailController.text.trim(),
          'password': _passwordController.text,
        },
      );

      if (response is! Map<String, dynamic>) {
        throw const ApiException(500, 'Unexpected login response format.');
      }

      final String? accessToken = response['accessToken']?.toString();
      final String? refreshToken = response['refreshToken']?.toString();
      final dynamic userPayload = response['user'];
      if (accessToken == null ||
          refreshToken == null ||
          userPayload is! Map<String, dynamic>) {
        throw const ApiException(500, 'Missing token pair or user payload.');
      }

      final String userId = userPayload['id']?.toString() ?? '';
      if (userId.isEmpty) {
        throw const ApiException(500, 'Missing authenticated user id.');
      }
      final List<String> roles =
          (userPayload['roles'] as List<dynamic>? ?? <dynamic>[])
              .map((dynamic role) => role.toString())
              .toList(growable: false);
      final List<String> permissions =
          (userPayload['permissions'] as List<dynamic>? ?? <dynamic>[])
              .map((dynamic permission) => permission.toString())
              .toList(growable: false);

      await widget.apiClient.setSession(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      context.read<AuthBloc>().add(
        AuthSessionSet(
          userId: userId,
          roles: roles,
          userPermissions: permissions,
        ),
      );

      if (!mounted) return;
      setState(() {
        _loading = false;
      });
      Navigator.of(context).pushReplacementNamed(AppRoutes.inventory);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Login failed. Please try again.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final bool wide = constraints.maxWidth >= 900;
            final Widget form = _buildFormCard(context);

            return Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1080),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: wide
                      ? Row(
                          children: <Widget>[
                            Expanded(child: const _BrandPanel()),
                            const SizedBox(width: 24),
                            SizedBox(width: 420, child: form),
                          ],
                        )
                      : SizedBox(width: 460, child: form),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildFormCard(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                'Sign in',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              const Text('Access your inventory and sales dashboard.'),
              const SizedBox(height: 18),
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const <String>[AutofillHints.email],
                decoration: const InputDecoration(
                  labelText: 'Email',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
                validator: (String? value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Email is required';
                  }
                  if (!value.contains('@')) return 'Enter a valid email';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                enableSuggestions: false,
                autocorrect: false,
                autofillHints: const <String>[AutofillHints.password],
                decoration: const InputDecoration(
                  labelText: 'Password',
                  prefixIcon: Icon(Icons.lock_outline),
                ),
                validator: (String? value) {
                  if (value == null || value.isEmpty) {
                    return 'Password is required';
                  }
                  if (value.length < 6) return 'Minimum 6 characters';
                  return null;
                },
              ),
              const SizedBox(height: 10),
              Row(
                children: <Widget>[
                  Checkbox(
                    value: _rememberMe,
                    onChanged: (bool? value) {
                      setState(() {
                        _rememberMe = value ?? false;
                      });
                    },
                  ),
                  const Expanded(child: Text('Remember me')),
                ],
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Login'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BrandPanel extends StatelessWidget {
  const _BrandPanel();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(26),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: Theme.of(
                  context,
                ).colorScheme.secondary.withOpacity(0.25),
              ),
              child: const Icon(Icons.point_of_sale_rounded),
            ),
            const SizedBox(height: 18),
            Text(
              'Inventory & POS',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            const Text(
              'Single codebase Flutter UI for Android, iOS, Web, and Desktop.',
            ),
          ],
        ),
      ),
    );
  }
}

class ProductDetailsPage extends StatelessWidget {
  const ProductDetailsPage({super.key, this.product});

  final Product? product;

  @override
  Widget build(BuildContext context) {
    final Product resolvedProduct =
        product ??
        const Product(
          id: 'unknown',
          sku: 'N/A',
          name: 'Unknown Product',
          category: 'N/A',
          unitPrice: 0,
          stockQty: 0,
          lowStockThreshold: 0,
        );

    return Scaffold(
      appBar: AppBar(title: const Text('Product Details')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 740),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      resolvedProduct.name,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 10),
                    Text('SKU: ${resolvedProduct.sku}'),
                    Text('Category: ${resolvedProduct.category}'),
                    Text('Stock: ${resolvedProduct.stockQty}'),
                    Text(
                      'Price: \$${resolvedProduct.unitPrice.toStringAsFixed(2)}',
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: <Widget>[
                        FilledButton.icon(
                          onPressed: () => Navigator.pushNamed(
                            context,
                            AppRoutes.cartCheckout,
                          ),
                          icon: const Icon(Icons.add_shopping_cart_outlined),
                          label: const Text('Add to Cart'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AccessDeniedPage extends StatelessWidget {
  const _AccessDeniedPage({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: const Center(
        child: Text('Access denied. You do not have permission for this page.'),
      ),
    );
  }
}
