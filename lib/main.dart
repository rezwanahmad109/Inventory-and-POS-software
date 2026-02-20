import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app_config.dart';
import 'app_routes.dart';
import 'core/api/api_client.dart';
import 'features/auth/bloc/auth_bloc.dart';
import 'features/auth/bloc/auth_event.dart';
import 'features/auth/bloc/auth_state.dart';
import 'features/roles/bloc/role_bloc.dart';
import 'features/roles/repository/role_repository.dart';
import 'features/roles/screens/role_management_screen.dart';
import 'screens/admin_settings_screen.dart';
import 'screens/checkout_screen.dart';
import 'screens/inventory_list_screen.dart';
import 'screens/purchase_return_screen.dart';
import 'screens/sales_history_screen.dart';
import 'screens/sales_return_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    // Fallback to compile-time --dart-define values when .env is absent.
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
    final ColorScheme scheme =
        ColorScheme.fromSeed(
          seedColor: _primaryBlue,
          brightness: Brightness.light,
        ).copyWith(
          primary: _primaryBlue,
          secondary: _accentGold,
          surface: Colors.white,
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
          colorScheme: scheme,
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
      if (
          accessToken == null ||
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

class CartCheckoutPage extends StatelessWidget {
  const CartCheckoutPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Shopping Cart & Checkout')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 960),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: LayoutBuilder(
              builder: (BuildContext context, BoxConstraints constraints) {
                final bool stacked = constraints.maxWidth < 760;
                final Widget order = const _CheckoutOrderPanel();
                final Widget payment = const _CheckoutPaymentPanel();

                if (stacked) {
                  return ListView(
                    children: <Widget>[
                      order,
                      const SizedBox(height: 12),
                      payment,
                    ],
                  );
                }
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Expanded(flex: 7, child: order),
                    const SizedBox(width: 12),
                    Expanded(flex: 5, child: payment),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _CheckoutOrderPanel extends StatelessWidget {
  const _CheckoutOrderPanel();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text('Order Items', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            const ListTile(
              dense: true,
              title: Text('USB Barcode Scanner'),
              subtitle: Text('Qty: 1'),
              trailing: Text('\$49.99'),
            ),
            const ListTile(
              dense: true,
              title: Text('Thermal Paper Roll'),
              subtitle: Text('Qty: 3'),
              trailing: Text('\$15.00'),
            ),
            const Divider(),
            const ListTile(
              dense: true,
              title: Text('Subtotal'),
              trailing: Text('\$64.99'),
            ),
            const ListTile(
              dense: true,
              title: Text('Tax'),
              trailing: Text('\$6.50'),
            ),
            const ListTile(
              dense: true,
              title: Text('Total'),
              trailing: Text('\$71.49'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CheckoutPaymentPanel extends StatelessWidget {
  const _CheckoutPaymentPanel();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text('Payment', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Customer Name',
                prefixIcon: Icon(Icons.person_outline),
              ),
            ),
            const SizedBox(height: 10),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Payment Method',
                prefixIcon: Icon(Icons.payments_outlined),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.check_circle_outline),
                label: const Text('Complete Sale'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SalesHistoryPage extends StatelessWidget {
  const SalesHistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    final List<SaleRecord> records = List<SaleRecord>.generate(
      30,
      (int i) => SaleRecord(
        invoiceNo: 'INV-${1200 + i}',
        customerName: i % 3 == 0 ? 'Walk-in' : 'Customer ${i + 1}',
        total: 39.5 + i * 3.2,
        date: DateTime.now().subtract(Duration(days: i)),
      ),
      growable: false,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Sales History')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: records.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (BuildContext context, int index) {
          final SaleRecord record = records[index];
          return Card(
            child: ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: Text(record.invoiceNo),
              subtitle: Text(
                '${record.customerName} | ${record.date.toLocal().toString().split(' ').first}',
              ),
              trailing: Text('\$${record.total.toStringAsFixed(2)}'),
            ),
          );
        },
      ),
    );
  }
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool _notifications = true;
  bool _compactMode = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          Card(
            child: SwitchListTile(
              title: const Text('Enable Notifications'),
              subtitle: const Text('Stock alerts and sales notifications'),
              value: _notifications,
              onChanged: (bool value) {
                setState(() => _notifications = value);
              },
            ),
          ),
          Card(
            child: SwitchListTile(
              title: const Text('Compact Inventory Rows'),
              subtitle: const Text('Show denser list rows for large catalogs'),
              value: _compactMode,
              onChanged: (bool value) {
                setState(() => _compactMode = value);
              },
            ),
          ),
          Card(
            child: ListTile(
              title: const Text('Backend Base URL'),
              subtitle: Text(AppConfig.apiBaseUrl),
              trailing: TextButton(onPressed: () {}, child: const Text('Edit')),
            ),
          ),
        ],
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

class SaleRecord {
  const SaleRecord({
    required this.invoiceNo,
    required this.customerName,
    required this.total,
    required this.date,
  });

  final String invoiceNo;
  final String customerName;
  final double total;
  final DateTime date;
}
