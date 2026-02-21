import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../app_routes.dart';
import '../core/api/api_client.dart';
import '../core/cache/product_cache_service.dart';
import '../core/ui/offline_status_banner.dart';
import '../features/auth/bloc/auth_bloc.dart';
import '../features/auth/bloc/auth_state.dart';

class InventoryListScreen extends StatefulWidget {
  const InventoryListScreen({required this.apiClient, super.key});

  final ApiClient apiClient;

  @override
  State<InventoryListScreen> createState() => _InventoryListScreenState();
}

class _InventoryListScreenState extends State<InventoryListScreen> {
  final TextEditingController _searchController = TextEditingController();
  late final InventoryApiService _apiService;

  late Future<List<Product>> _productsFuture;
  Timer? _searchDebounce;
  bool _showLowStockOnly = false;

  @override
  void initState() {
    super.initState();
    _apiService = InventoryApiService(apiClient: widget.apiClient);
    _productsFuture = _apiService.fetchProducts();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refreshProducts() async {
    final Future<List<Product>> request = _apiService.fetchProducts(
      query: _searchController.text.trim(),
    );
    setState(() {
      _productsFuture = request;
    });
    await request;
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() {
        _productsFuture = _apiService.fetchProducts(query: value.trim());
      });
    });
  }

  void _navigateToSection(String route) {
    final String? currentRoute = ModalRoute.of(context)?.settings.name;
    if (currentRoute == route) return;
    Navigator.pushReplacementNamed(context, route);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory List'),
        actions: <Widget>[
          BlocBuilder<AuthBloc, AuthState>(
            builder: (BuildContext context, AuthState authState) {
              if (!authState.hasPermission('roles.read')) {
                return const SizedBox.shrink();
              }
              return IconButton(
                tooltip: 'Role Management',
                onPressed: () => _navigateToSection(AppRoutes.roles),
                icon: const Icon(Icons.admin_panel_settings_outlined),
              );
            },
          ),
          BlocBuilder<AuthBloc, AuthState>(
            builder: (BuildContext context, AuthState authState) {
              final bool canSalesReturn = authState.hasPermission(
                'sales_returns.create',
              );
              final bool canPurchaseReturn = authState.hasPermission(
                'purchase_returns.create',
              );
              if (!canSalesReturn && !canPurchaseReturn) {
                return const SizedBox.shrink();
              }

              return PopupMenuButton<String>(
                tooltip: 'Returns',
                icon: const Icon(Icons.assignment_return_outlined),
                onSelected: (String route) => _navigateToSection(route),
                itemBuilder: (_) => <PopupMenuEntry<String>>[
                  if (canSalesReturn)
                    const PopupMenuItem<String>(
                      value: AppRoutes.salesReturn,
                      child: Text('Sales Return'),
                    ),
                  if (canPurchaseReturn)
                    const PopupMenuItem<String>(
                      value: AppRoutes.purchaseReturn,
                      child: Text('Purchase Return'),
                    ),
                ],
              );
            },
          ),
          IconButton(
            tooltip: 'Sales History',
            onPressed: () => _navigateToSection(AppRoutes.salesHistory),
            icon: const Icon(Icons.history),
          ),
          BlocBuilder<AuthBloc, AuthState>(
            builder: (BuildContext context, AuthState authState) {
              final bool canAccessSalesOps = authState.hasPermission(
                'sales.view',
              );
              final bool canAccessPurchaseOps = authState.hasPermission(
                'purchases.read',
              );
              final bool canAccessWarehouseOps = authState.hasPermission(
                'warehouses.read',
              );
              final bool canAccessReports =
                  authState.hasPermission('reports.view') ||
                  authState.hasPermission('dashboard.view');
              final bool canAccessFinanceSettings = authState.hasAnyRole(
                const <String>['admin', 'super_admin'],
              );
              final bool canAccessUserAccess =
                  authState.hasPermission('users.read') ||
                  authState.hasPermission('roles.read');

              if (!canAccessSalesOps &&
                  !canAccessPurchaseOps &&
                  !canAccessWarehouseOps &&
                  !canAccessReports &&
                  !canAccessFinanceSettings &&
                  !canAccessUserAccess) {
                return const SizedBox.shrink();
              }

              return PopupMenuButton<String>(
                tooltip: 'Operations',
                icon: const Icon(Icons.dashboard_customize_outlined),
                onSelected: _navigateToSection,
                itemBuilder: (_) => <PopupMenuEntry<String>>[
                  if (canAccessSalesOps)
                    const PopupMenuItem<String>(
                      value: AppRoutes.salesOps,
                      child: Text('Sales Operations'),
                    ),
                  if (canAccessPurchaseOps)
                    const PopupMenuItem<String>(
                      value: AppRoutes.purchaseOps,
                      child: Text('Purchase Operations'),
                    ),
                  if (canAccessWarehouseOps)
                    const PopupMenuItem<String>(
                      value: AppRoutes.warehouseOps,
                      child: Text('Warehouse Operations'),
                    ),
                  if (canAccessReports)
                    const PopupMenuItem<String>(
                      value: AppRoutes.reportingDashboard,
                      child: Text('Reporting Dashboard'),
                    ),
                  if (canAccessFinanceSettings)
                    const PopupMenuItem<String>(
                      value: AppRoutes.financeSettings,
                      child: Text('Finance Settings'),
                    ),
                  if (canAccessUserAccess)
                    const PopupMenuItem<String>(
                      value: AppRoutes.userAccess,
                      child: Text('User Access'),
                    ),
                ],
              );
            },
          ),
          BlocBuilder<AuthBloc, AuthState>(
            builder: (BuildContext context, AuthState authState) {
              if (!authState.hasAnyRole(const <String>[
                'admin',
                'super_admin',
              ])) {
                return const SizedBox.shrink();
              }
              return IconButton(
                tooltip: 'Settings',
                onPressed: () => _navigateToSection(AppRoutes.settings),
                icon: const Icon(Icons.settings_outlined),
              );
            },
          ),
        ],
      ),
      drawer: BlocBuilder<AuthBloc, AuthState>(
        builder: (BuildContext context, AuthState authState) {
          return _AppDrawer(
            onNavigate: _navigateToSection,
            canManageRoles: authState.hasPermission('roles.read'),
            canCreateSalesReturn: authState.hasPermission(
              'sales_returns.create',
            ),
            canCreatePurchaseReturn: authState.hasPermission(
              'purchase_returns.create',
            ),
            canAccessSettings: authState.hasAnyRole(const <String>[
              'admin',
              'super_admin',
            ]),
            canAccessSalesOps: authState.hasPermission('sales.view'),
            canAccessPurchaseOps: authState.hasPermission('purchases.read'),
            canAccessWarehouseOps: authState.hasPermission('warehouses.read'),
            canAccessReports:
                authState.hasPermission('reports.view') ||
                authState.hasPermission('dashboard.view'),
            canAccessFinanceSettings: authState.hasAnyRole(const <String>[
              'admin',
              'super_admin',
            ]),
            canAccessUserAccess:
                authState.hasPermission('users.read') ||
                authState.hasPermission('roles.read'),
          );
        },
      ),
      body: SafeArea(
        child: OfflineStatusBanner(
          apiClient: widget.apiClient,
          child: Column(
            children: <Widget>[
              _InventoryToolbar(
                searchController: _searchController,
                showLowStockOnly: _showLowStockOnly,
                onSearchChanged: _onSearchChanged,
                onToggleLowStock: (bool value) {
                  setState(() => _showLowStockOnly = value);
                },
              ),
              Expanded(
                child: FutureBuilder<List<Product>>(
                  future: _productsFuture,
                  builder:
                      (
                        BuildContext context,
                        AsyncSnapshot<List<Product>> snapshot,
                      ) {
                        if (snapshot.connectionState ==
                            ConnectionState.waiting) {
                          return const Center(
                            child: CircularProgressIndicator(),
                          );
                        }
                        if (snapshot.hasError) {
                          return _ErrorState(
                            message: 'Failed to load products.',
                            onRetry: _refreshProducts,
                          );
                        }
                        final List<Product> products =
                            snapshot.data ?? <Product>[];
                        final List<Product> visibleProducts = _showLowStockOnly
                            ? products
                                  .where((Product p) => p.isLowStock)
                                  .toList()
                            : products;

                        if (visibleProducts.isEmpty) {
                          return const _EmptyState();
                        }
                        return RefreshIndicator(
                          onRefresh: _refreshProducts,
                          child: _ResponsiveProductCollection(
                            products: visibleProducts,
                          ),
                        );
                      },
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: BlocBuilder<AuthBloc, AuthState>(
        builder: (BuildContext context, AuthState authState) {
          if (!authState.hasPermission('inventory.create')) {
            return const SizedBox.shrink();
          }

          return FloatingActionButton.extended(
            onPressed: () {},
            icon: const Icon(Icons.add),
            label: const Text('Add Product'),
          );
        },
      ),
      bottomNavigationBar: BlocBuilder<AuthBloc, AuthState>(
        builder: (BuildContext context, AuthState authState) {
          final bool canAccessSettings = authState.hasAnyRole(const <String>[
            'admin',
            'super_admin',
          ]);

          final List<String?> routes = <String?>[
            null,
            AppRoutes.cartCheckout,
            AppRoutes.salesHistory,
            if (canAccessSettings) AppRoutes.settings,
          ];

          final List<NavigationDestination> destinations =
              <NavigationDestination>[
                const NavigationDestination(
                  icon: Icon(Icons.inventory_2_outlined),
                  label: 'Inventory',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.shopping_cart_checkout),
                  label: 'Checkout',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.receipt_long_outlined),
                  label: 'Sales',
                ),
                if (canAccessSettings)
                  const NavigationDestination(
                    icon: Icon(Icons.settings_outlined),
                    label: 'Settings',
                  ),
              ];

          return NavigationBar(
            selectedIndex: 0,
            destinations: destinations,
            onDestinationSelected: (int index) {
              final String? route = routes[index];
              if (route != null) {
                _navigateToSection(route);
              }
            },
          );
        },
      ),
    );
  }
}

class _AppDrawer extends StatelessWidget {
  const _AppDrawer({
    required this.onNavigate,
    required this.canManageRoles,
    required this.canCreateSalesReturn,
    required this.canCreatePurchaseReturn,
    required this.canAccessSettings,
    required this.canAccessSalesOps,
    required this.canAccessPurchaseOps,
    required this.canAccessWarehouseOps,
    required this.canAccessReports,
    required this.canAccessFinanceSettings,
    required this.canAccessUserAccess,
  });

  final ValueChanged<String> onNavigate;
  final bool canManageRoles;
  final bool canCreateSalesReturn;
  final bool canCreatePurchaseReturn;
  final bool canAccessSettings;
  final bool canAccessSalesOps;
  final bool canAccessPurchaseOps;
  final bool canAccessWarehouseOps;
  final bool canAccessReports;
  final bool canAccessFinanceSettings;
  final bool canAccessUserAccess;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: ListView(
        children: <Widget>[
          DrawerHeader(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
            ),
            child: const Align(
              alignment: Alignment.bottomLeft,
              child: Text(
                'Inventory & POS',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.inventory_2_outlined),
            title: const Text('Inventory'),
            onTap: () {
              Navigator.pop(context);
              onNavigate(AppRoutes.inventory);
            },
          ),
          ListTile(
            leading: const Icon(Icons.shopping_cart_checkout),
            title: const Text('Cart / Checkout'),
            onTap: () {
              Navigator.pop(context);
              onNavigate(AppRoutes.cartCheckout);
            },
          ),
          ListTile(
            leading: const Icon(Icons.history),
            title: const Text('Sales History'),
            onTap: () {
              Navigator.pop(context);
              onNavigate(AppRoutes.salesHistory);
            },
          ),
          if (canCreateSalesReturn)
            ListTile(
              leading: const Icon(Icons.assignment_return_outlined),
              title: const Text('Sales Return'),
              onTap: () {
                Navigator.pop(context);
                onNavigate(AppRoutes.salesReturn);
              },
            ),
          if (canCreatePurchaseReturn)
            ListTile(
              leading: const Icon(Icons.keyboard_return_outlined),
              title: const Text('Purchase Return'),
              onTap: () {
                Navigator.pop(context);
                onNavigate(AppRoutes.purchaseReturn);
              },
            ),
          if (canAccessSettings)
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Settings'),
              onTap: () {
                Navigator.pop(context);
                onNavigate(AppRoutes.settings);
              },
            ),
          if (canManageRoles)
            ListTile(
              leading: const Icon(Icons.admin_panel_settings_outlined),
              title: const Text('Role Management'),
              onTap: () {
                Navigator.pop(context);
                onNavigate(AppRoutes.roles);
              },
            ),
          if (canAccessSalesOps ||
              canAccessPurchaseOps ||
              canAccessWarehouseOps ||
              canAccessReports ||
              canAccessFinanceSettings ||
              canAccessUserAccess)
            const Divider(),
          if (canAccessSalesOps)
            ListTile(
              leading: const Icon(Icons.sell_outlined),
              title: const Text('Sales Operations'),
              onTap: () {
                Navigator.pop(context);
                onNavigate(AppRoutes.salesOps);
              },
            ),
          if (canAccessPurchaseOps)
            ListTile(
              leading: const Icon(Icons.shopping_bag_outlined),
              title: const Text('Purchase Operations'),
              onTap: () {
                Navigator.pop(context);
                onNavigate(AppRoutes.purchaseOps);
              },
            ),
          if (canAccessWarehouseOps)
            ListTile(
              leading: const Icon(Icons.warehouse_outlined),
              title: const Text('Warehouse Operations'),
              onTap: () {
                Navigator.pop(context);
                onNavigate(AppRoutes.warehouseOps);
              },
            ),
          if (canAccessReports)
            ListTile(
              leading: const Icon(Icons.bar_chart_outlined),
              title: const Text('Reporting Dashboard'),
              onTap: () {
                Navigator.pop(context);
                onNavigate(AppRoutes.reportingDashboard);
              },
            ),
          if (canAccessFinanceSettings)
            ListTile(
              leading: const Icon(Icons.account_balance_outlined),
              title: const Text('Finance Settings'),
              onTap: () {
                Navigator.pop(context);
                onNavigate(AppRoutes.financeSettings);
              },
            ),
          if (canAccessUserAccess)
            ListTile(
              leading: const Icon(Icons.supervised_user_circle_outlined),
              title: const Text('User Access'),
              onTap: () {
                Navigator.pop(context);
                onNavigate(AppRoutes.userAccess);
              },
            ),
        ],
      ),
    );
  }
}

class _InventoryToolbar extends StatelessWidget {
  const _InventoryToolbar({
    required this.searchController,
    required this.showLowStockOnly,
    required this.onSearchChanged,
    required this.onToggleLowStock,
  });

  final TextEditingController searchController;
  final bool showLowStockOnly;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<bool> onToggleLowStock;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          final bool stacked = constraints.maxWidth < 720;

          final Widget search = TextField(
            controller: searchController,
            onChanged: onSearchChanged,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search by name, SKU, or category',
            ),
          );

          final Widget lowStockFilter = FilterChip(
            label: const Text('Low stock only'),
            selected: showLowStockOnly,
            onSelected: onToggleLowStock,
            selectedColor: Theme.of(
              context,
            ).colorScheme.secondary.withOpacity(0.28),
          );

          if (stacked) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                search,
                const SizedBox(height: 10),
                lowStockFilter,
              ],
            );
          }

          return Row(
            children: <Widget>[
              Expanded(child: search),
              const SizedBox(width: 10),
              lowStockFilter,
            ],
          );
        },
      ),
    );
  }
}

class _ResponsiveProductCollection extends StatelessWidget {
  const _ResponsiveProductCollection({required this.products});

  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        if (constraints.maxWidth < 780) {
          return ListView.separated(
            key: const PageStorageKey<String>('inventory-list-mobile'),
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 18),
            itemCount: products.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (BuildContext context, int index) {
              final Product product = products[index];
              return _ProductListTile(product: product);
            },
          );
        }

        final int columns = constraints.maxWidth >= 1280 ? 4 : 2;
        return GridView.builder(
          key: const PageStorageKey<String>('inventory-grid-desktop'),
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 18),
          itemCount: products.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            childAspectRatio: 1.62,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemBuilder: (BuildContext context, int index) {
            final Product product = products[index];
            return _ProductCard(product: product);
          },
        );
      },
    );
  }
}

class _ProductListTile extends StatelessWidget {
  const _ProductListTile({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final bool lowStock = product.isLowStock;
    return Card(
      child: ListTile(
        key: ValueKey<String>(product.id),
        onTap: () {
          Navigator.pushNamed(
            context,
            AppRoutes.productDetails,
            arguments: product,
          );
        },
        leading: CircleAvatar(
          backgroundColor: Theme.of(
            context,
          ).colorScheme.secondary.withOpacity(0.22),
          child: Text(
            product.name.isEmpty ? '?' : product.name[0].toUpperCase(),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        title: Text(product.name),
        subtitle: Text('SKU: ${product.sku} | ${product.category}'),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            Text('\$${product.unitPrice.toStringAsFixed(2)}'),
            Text(
              'Stock: ${product.stockQty}',
              style: TextStyle(
                color: lowStock ? Colors.red.shade700 : Colors.black54,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final bool lowStock = product.isLowStock;
    return RepaintBoundary(
      child: Card(
        key: ValueKey<String>('card-${product.id}'),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () {
            Navigator.pushNamed(
              context,
              AppRoutes.productDetails,
              arguments: product,
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        product.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    if (lowStock)
                      Chip(
                        label: const Text('Low'),
                        visualDensity: VisualDensity.compact,
                        backgroundColor: Theme.of(
                          context,
                        ).colorScheme.secondary.withOpacity(0.25),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text('SKU: ${product.sku}'),
                const Spacer(),
                Text(
                  '\$${product.unitPrice.toStringAsFixed(2)}',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  'Stock: ${product.stockQty}',
                  style: TextStyle(
                    color: lowStock ? Colors.red.shade700 : Colors.black54,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              Icons.inventory_2_outlined,
              size: 44,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 10),
            const Text('No products found'),
            const SizedBox(height: 4),
            const Text(
              'Try a different search or turn off filters.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(message),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class Product {
  const Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.category,
    required this.unitPrice,
    required this.stockQty,
    required this.lowStockThreshold,
  });

  final String id;
  final String sku;
  final String name;
  final String category;
  final double unitPrice;
  final int stockQty;
  final int lowStockThreshold;

  bool get isLowStock => lowStockThreshold > 0 && stockQty <= lowStockThreshold;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'sku': sku,
      'name': name,
      'category': category,
      'unitPrice': unitPrice,
      'stockQty': stockQty,
      'lowStockThreshold': lowStockThreshold,
    };
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    final num thresholdRaw =
        (json['lowStockThreshold'] as num?) ??
        (json['low_stock_threshold'] as num?) ??
        0;
    final dynamic categoryPayload = json['category'];
    final String category = categoryPayload is Map<String, dynamic>
        ? (categoryPayload['name']?.toString() ?? 'General')
        : (categoryPayload?.toString() ?? 'General');

    return Product(
      id: '${json['id'] ?? ''}',
      sku: '${json['sku'] ?? ''}',
      name: '${json['name'] ?? ''}',
      category: category,
      unitPrice:
          (json['unitPrice'] as num?)?.toDouble() ??
          (json['price'] as num?)?.toDouble() ??
          0,
      stockQty:
          (json['stockQty'] as num?)?.toInt() ??
          (json['stock_qty'] as num?)?.toInt() ??
          0,
      lowStockThreshold: thresholdRaw.toInt(),
    );
  }
}

class InventoryApiService {
  InventoryApiService({required ApiClient apiClient})
    : _apiClient = apiClient,
      _cacheService = ProductCacheService();

  final ApiClient _apiClient;
  final ProductCacheService _cacheService;

  Future<List<Product>> fetchProducts({String query = ''}) async {
    try {
      dynamic payload;
      if (query.isEmpty) {
        payload = await _apiClient.get(
          'products',
          query: const <String, String>{'page': '1', 'limit': '100'},
        );
      } else {
        payload = await _apiClient.get(
          'products/search',
          query: <String, String>{'q': query, 'limit': '100'},
        );
      }

      if (payload is List<dynamic>) {
        final List<Product> products = _asProductList(payload);
        if (query.isEmpty) {
          await _cacheService.cacheProducts(
            products.map((Product product) => product.toJson()).toList(),
          );
        }
        return products;
      }
      if (payload is Map<String, dynamic>) {
        final dynamic collection = payload['items'] ?? payload['data'];
        if (collection is List<dynamic>) {
          final List<Product> products = _asProductList(collection);
          if (query.isEmpty) {
            await _cacheService.cacheProducts(
              products.map((Product product) => product.toJson()).toList(),
            );
          }
          return products;
        }
      }
    } catch (_) {
      if (query.isNotEmpty) {
        rethrow;
      }

      final List<Map<String, dynamic>> cachedProducts = await _cacheService
          .readCachedProducts();
      if (cachedProducts.isNotEmpty) {
        return cachedProducts.map(Product.fromJson).toList(growable: false);
      }
    }
    throw const FormatException('Unexpected products payload shape.');
  }

  List<Product> _asProductList(List<dynamic> rows) {
    return rows
        .whereType<Map<String, dynamic>>()
        .map(Product.fromJson)
        .toList(growable: false);
  }
}
