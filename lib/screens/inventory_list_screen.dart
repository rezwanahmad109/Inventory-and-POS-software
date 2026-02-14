import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

import '../app_config.dart';
import '../app_routes.dart';
import '../features/auth/bloc/auth_bloc.dart';
import '../features/auth/bloc/auth_state.dart';

class InventoryListScreen extends StatefulWidget {
  const InventoryListScreen({super.key});

  @override
  State<InventoryListScreen> createState() => _InventoryListScreenState();
}

class _InventoryListScreenState extends State<InventoryListScreen> {
  final TextEditingController _searchController = TextEditingController();
  final InventoryApiService _apiService = InventoryApiService(
    baseUri: AppConfig.apiBaseUri,
  );

  late Future<List<Product>> _productsFuture;
  Timer? _searchDebounce;
  bool _showLowStockOnly = false;

  @override
  void initState() {
    super.initState();
    _productsFuture = _apiService.fetchProducts();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    _apiService.dispose();
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
              if (
                  !authState.hasAnyRole(
                    const <String>['admin', 'super_admin'],
                  )) {
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
            canAccessSettings: authState.hasAnyRole(
              const <String>['admin', 'super_admin'],
            ),
          );
        },
      ),
      body: SafeArea(
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
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
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
          final bool canAccessSettings = authState.hasAnyRole(
            const <String>['admin', 'super_admin'],
          );

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
  });

  final ValueChanged<String> onNavigate;
  final bool canManageRoles;
  final bool canCreateSalesReturn;
  final bool canCreatePurchaseReturn;
  final bool canAccessSettings;

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

  bool get isLowStock =>
      lowStockThreshold > 0 && stockQty <= lowStockThreshold;

  factory Product.fromJson(Map<String, dynamic> json) {
    final num thresholdRaw =
        (json['lowStockThreshold'] as num?) ??
        (json['low_stock_threshold'] as num?) ??
        0;

    return Product(
      id: '${json['id'] ?? ''}',
      sku: '${json['sku'] ?? ''}',
      name: '${json['name'] ?? ''}',
      category: '${json['category'] ?? 'General'}',
      unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0,
      stockQty: (json['stockQty'] as num?)?.toInt() ?? 0,
      lowStockThreshold: thresholdRaw.toInt(),
    );
  }
}

class InventoryApiService {
  InventoryApiService({required this.baseUri, http.Client? client})
    : _client = client ?? http.Client();

  static const Duration _requestTimeout = Duration(seconds: 8);

  final Uri baseUri;
  final http.Client _client;

  Future<List<Product>> fetchProducts({String query = ''}) async {
    final Uri uri = _buildProductsUri(query: query);

    try {
      final http.Response response = await _client
          .get(uri)
          .timeout(_requestTimeout);
      if (response.statusCode == 200) {
        final dynamic decoded = jsonDecode(response.body);
        if (decoded is List<dynamic>) {
          return _asProductList(decoded);
        }
        if (decoded is Map<String, dynamic>) {
          final dynamic collection = decoded['items'] ?? decoded['data'];
          if (collection is List<dynamic>) {
            return _asProductList(collection);
          }
        }
        throw const FormatException('Unexpected products payload shape.');
      }
      throw Exception('API response ${response.statusCode}');
    } catch (_) {
      // Keep UI work unblocked with local fallback data when API is unavailable.
      final List<Product> fallback = _seedProducts;
      if (query.isEmpty) return fallback;
      final String q = query.toLowerCase();
      return fallback
          .where(
            (Product p) =>
                p.name.toLowerCase().contains(q) ||
                p.sku.toLowerCase().contains(q) ||
                p.category.toLowerCase().contains(q),
          )
          .toList(growable: false);
    }
  }

  Uri _buildProductsUri({required String query}) {
    final Uri endpoint = baseUri.resolve(
      baseUri.path.endsWith('/') ? 'products' : '${baseUri.path}/products',
    );
    if (query.isEmpty) return endpoint;
    return endpoint.replace(queryParameters: <String, String>{'query': query});
  }

  List<Product> _asProductList(List<dynamic> rows) {
    return rows
        .whereType<Map<String, dynamic>>()
        .map(Product.fromJson)
        .toList(growable: false);
  }

  void dispose() {
    _client.close();
  }
}

const List<Product> _seedProducts = <Product>[
  Product(
    id: '1',
    sku: 'SKU-1001',
    name: 'Barcode Scanner',
    category: 'Hardware',
    unitPrice: 49.99,
    stockQty: 18,
    lowStockThreshold: 6,
  ),
  Product(
    id: '2',
    sku: 'SKU-1002',
    name: 'Thermal Printer',
    category: 'Hardware',
    unitPrice: 179.0,
    stockQty: 7,
    lowStockThreshold: 8,
  ),
  Product(
    id: '3',
    sku: 'SKU-1003',
    name: 'Receipt Roll',
    category: 'Consumables',
    unitPrice: 4.99,
    stockQty: 92,
    lowStockThreshold: 12,
  ),
  Product(
    id: '4',
    sku: 'SKU-1004',
    name: 'Card Reader',
    category: 'Hardware',
    unitPrice: 89.5,
    stockQty: 11,
    lowStockThreshold: 10,
  ),
  Product(
    id: '5',
    sku: 'SKU-1005',
    name: 'Cash Drawer',
    category: 'Hardware',
    unitPrice: 129.0,
    stockQty: 5,
    lowStockThreshold: 5,
  ),
  Product(
    id: '6',
    sku: 'SKU-1006',
    name: 'USB Keyboard',
    category: 'Accessories',
    unitPrice: 24.0,
    stockQty: 33,
    lowStockThreshold: 7,
  ),
];
