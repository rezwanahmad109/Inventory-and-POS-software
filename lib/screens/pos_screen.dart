import 'dart:collection';

import 'package:flutter/material.dart';

import '../app_routes.dart';

const Color kPosPrimaryBlue = Color(0xFF1F4FFF);
const Color kPosAccentGold = Color(0xFFD4AF37);

/// Main POS screen with responsive product/catalog and cart regions.
class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  late final PosController _controller;

  @override
  void initState() {
    super.initState();
    _controller = PosController(
      products: kMockProducts,
      taxRate: 0.05, // Placeholder tax (replace with backend config later).
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _openRoute(BuildContext context, String route) {
    final String? currentRoute = ModalRoute.of(context)?.settings.name;
    if (currentRoute == route) return;
    Navigator.of(context).pushReplacementNamed(route);
  }

  void _openCheckout(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const CheckoutPlaceholderScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: POSAppBar(
        onInventoryTap: () => _openRoute(context, AppRoutes.inventory),
        onSalesHistoryTap: () => _openRoute(context, AppRoutes.salesHistory),
        onSettingsTap: () => _openRoute(context, AppRoutes.settings),
      ),
      body: SafeArea(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (BuildContext context, _) {
            return LayoutBuilder(
              builder: (BuildContext context, BoxConstraints constraints) {
                final bool wideLayout = constraints.maxWidth >= 1024;
                final double cartHeight = constraints.maxWidth >= 700 ? 320 : 280;

                if (wideLayout) {
                  return Row(
                    children: <Widget>[
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: ProductGridView(
                            products: _controller.products,
                            quantityByProduct: _controller.quantityByProduct,
                            canAddProduct: _controller.canAddProduct,
                            onProductTap: _controller.addProduct,
                          ),
                        ),
                      ),
                      const VerticalDivider(width: 1),
                      SizedBox(
                        width: 390,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: CartPanel(
                            items: _controller.cartItems,
                            subtotal: _controller.subtotal,
                            tax: _controller.taxAmount,
                            total: _controller.total,
                            onIncrement: _controller.incrementQuantity,
                            onDecrement: _controller.decrementQuantity,
                            onRemove: _controller.removeLine,
                            canIncrement: _controller.canAddProduct,
                            onCheckout: _controller.cartItems.isEmpty
                                ? null
                                : () => _openCheckout(context),
                          ),
                        ),
                      ),
                    ],
                  );
                }

                return Column(
                  children: <Widget>[
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                        child: ProductGridView(
                          products: _controller.products,
                          quantityByProduct: _controller.quantityByProduct,
                          canAddProduct: _controller.canAddProduct,
                          onProductTap: _controller.addProduct,
                        ),
                      ),
                    ),
                    SizedBox(
                      height: cartHeight,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                        child: CartPanel(
                          items: _controller.cartItems,
                          subtotal: _controller.subtotal,
                          tax: _controller.taxAmount,
                          total: _controller.total,
                          onIncrement: _controller.incrementQuantity,
                          onDecrement: _controller.decrementQuantity,
                          onRemove: _controller.removeLine,
                          canIncrement: _controller.canAddProduct,
                          onCheckout: _controller.cartItems.isEmpty
                              ? null
                              : () => _openCheckout(context),
                        ),
                      ),
                    ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// Custom POS AppBar with action buttons for primary navigation.
class POSAppBar extends StatelessWidget implements PreferredSizeWidget {
  const POSAppBar({
    super.key,
    required this.onInventoryTap,
    required this.onSalesHistoryTap,
    required this.onSettingsTap,
  });

  final VoidCallback onInventoryTap;
  final VoidCallback onSalesHistoryTap;
  final VoidCallback onSettingsTap;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final bool compact = MediaQuery.of(context).size.width < 760;

    return AppBar(
      title: const Text(
        'POS',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      backgroundColor: Colors.white,
      foregroundColor: kPosPrimaryBlue,
      surfaceTintColor: Colors.white,
      actions: compact
          ? <Widget>[
              PopupMenuButton<String>(
                tooltip: 'Menu',
                onSelected: (String value) {
                  switch (value) {
                    case 'inventory':
                      onInventoryTap();
                      break;
                    case 'sales':
                      onSalesHistoryTap();
                      break;
                    case 'settings':
                      onSettingsTap();
                      break;
                    default:
                      break;
                  }
                },
                itemBuilder: (BuildContext context) => const <PopupMenuEntry<String>>[
                  PopupMenuItem<String>(
                    value: 'inventory',
                    child: Text('Inventory'),
                  ),
                  PopupMenuItem<String>(
                    value: 'sales',
                    child: Text('Sales History'),
                  ),
                  PopupMenuItem<String>(
                    value: 'settings',
                    child: Text('Settings'),
                  ),
                ],
              ),
            ]
          : <Widget>[
              _AppBarActionButton(
                label: 'Inventory',
                icon: Icons.inventory_2_outlined,
                onPressed: onInventoryTap,
              ),
              _AppBarActionButton(
                label: 'Sales History',
                icon: Icons.receipt_long_outlined,
                onPressed: onSalesHistoryTap,
              ),
              _AppBarActionButton(
                label: 'Settings',
                icon: Icons.settings_outlined,
                onPressed: onSettingsTap,
              ),
              const SizedBox(width: 8),
            ],
    );
  }
}

class _AppBarActionButton extends StatelessWidget {
  const _AppBarActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: TextButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 18),
        label: Text(label),
      ),
    );
  }
}

/// Product catalog grid (2-4 columns based on width).
class ProductGridView extends StatelessWidget {
  const ProductGridView({
    super.key,
    required this.products,
    required this.quantityByProduct,
    required this.canAddProduct,
    required this.onProductTap,
  });

  final List<PosProduct> products;
  final Map<String, int> quantityByProduct;
  final bool Function(PosProduct product) canAddProduct;
  final ValueChanged<PosProduct> onProductTap;

  int _columnsFor(double width) {
    if (width >= 1320) return 4;
    if (width >= 900) return 3;
    return 2;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final int columns = _columnsFor(constraints.maxWidth);
        return GridView.builder(
          key: const PageStorageKey<String>('pos-product-grid'),
          itemCount: products.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 0.80,
          ),
          itemBuilder: (BuildContext context, int index) {
            final PosProduct product = products[index];
            final int inCart = quantityByProduct[product.id] ?? 0;
            final bool lowStock = product.stockQty <= 8;
            final bool canAdd = canAddProduct(product);

            return RepaintBoundary(
              child: Card(
                elevation: 1.2,
                color: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: BorderSide(
                    color: lowStock
                        ? Colors.orange.withOpacity(0.35)
                        : Colors.blueGrey.withOpacity(0.12),
                  ),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: canAdd ? () => onProductTap(product) : null,
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        _ProductImage(imageUrl: product.imageUrl),
                        const SizedBox(height: 8),
                        Text(
                          product.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '\$${product.price.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: kPosAccentGold,
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Stock: ${product.stockQty}',
                          style: TextStyle(
                            color: lowStock ? Colors.red.shade700 : Colors.black54,
                            fontSize: 12.5,
                          ),
                        ),
                        const Spacer(),
                        Row(
                          children: <Widget>[
                            Expanded(
                              child: FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: kPosPrimaryBlue,
                                ),
                                onPressed: canAdd ? () => onProductTap(product) : null,
                                child: Text(canAdd ? 'Add' : 'Max'),
                              ),
                            ),
                            if (inCart > 0) ...<Widget>[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: kPosAccentGold.withOpacity(0.18),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'x$inCart',
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _ProductImage extends StatelessWidget {
  const _ProductImage({required this.imageUrl});

  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: AspectRatio(
        aspectRatio: 4 / 3,
        child: Image.network(
          imageUrl,
          fit: BoxFit.cover,
          errorBuilder: (BuildContext context, Object _, StackTrace? __) {
            return Container(
              color: Colors.blueGrey.withOpacity(0.08),
              alignment: Alignment.center,
              child: const Icon(Icons.image_not_supported_outlined),
            );
          },
          loadingBuilder: (
            BuildContext context,
            Widget child,
            ImageChunkEvent? progress,
          ) {
            if (progress == null) return child;
            return Container(
              color: Colors.blueGrey.withOpacity(0.06),
              alignment: Alignment.center,
              child: const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Cart panel for selected POS items with quantity controls and totals.
class CartPanel extends StatelessWidget {
  const CartPanel({
    super.key,
    required this.items,
    required this.subtotal,
    required this.tax,
    required this.total,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
    required this.canIncrement,
    required this.onCheckout,
  });

  final List<CartLine> items;
  final double subtotal;
  final double tax;
  final double total;
  final ValueChanged<PosProduct> onIncrement;
  final ValueChanged<PosProduct> onDecrement;
  final ValueChanged<PosProduct> onRemove;
  final bool Function(PosProduct product) canIncrement;
  final VoidCallback? onCheckout;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.blueGrey.withOpacity(0.15)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: <Widget>[
            Row(
              children: <Widget>[
                const Icon(Icons.shopping_cart_checkout, color: kPosPrimaryBlue),
                const SizedBox(width: 8),
                const Text(
                  'Cart',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                Text(
                  '${items.length} item(s)',
                  style: const TextStyle(color: Colors.black54),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Expanded(
              child: items.isEmpty
                  ? const _EmptyCartView()
                  : ListView.separated(
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const Divider(height: 10),
                      itemBuilder: (BuildContext context, int index) {
                        final CartLine line = items[index];
                        return _CartLineTile(
                          line: line,
                          onIncrement: () => onIncrement(line.product),
                          onDecrement: () => onDecrement(line.product),
                          onRemove: () => onRemove(line.product),
                          canIncrement: canIncrement(line.product),
                        );
                      },
                    ),
            ),
            const Divider(height: 12),
            _TotalRow(label: 'Subtotal', value: subtotal),
            _TotalRow(label: 'Tax (placeholder)', value: tax),
            const SizedBox(height: 3),
            _TotalRow(label: 'Total', value: total, emphasize: true),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: kPosPrimaryBlue,
                  disabledBackgroundColor: Colors.blueGrey.withOpacity(0.25),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: onCheckout,
                child: const Text(
                  'Checkout',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CartLineTile extends StatelessWidget {
  const _CartLineTile({
    required this.line,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
    required this.canIncrement,
  });

  final CartLine line;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;
  final bool canIncrement;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                line.product.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 2),
              Text(
                '\$${line.product.price.toStringAsFixed(2)} x ${line.quantity}',
                style: const TextStyle(color: Colors.black54, fontSize: 12.5),
              ),
            ],
          ),
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          onPressed: onDecrement,
          icon: const Icon(Icons.remove_circle_outline),
          tooltip: 'Decrease',
        ),
        Text(
          '${line.quantity}',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          onPressed: canIncrement ? onIncrement : null,
          icon: const Icon(Icons.add_circle_outline),
          tooltip: 'Increase',
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          onPressed: onRemove,
          color: Colors.red.shade700,
          icon: const Icon(Icons.delete_outline),
          tooltip: 'Remove',
        ),
      ],
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final double value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final TextStyle style = TextStyle(
      fontSize: emphasize ? 18 : 14,
      fontWeight: emphasize ? FontWeight.w800 : FontWeight.w500,
      color: emphasize ? kPosPrimaryBlue : Colors.black87,
    );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: <Widget>[
          Text(label, style: style),
          const Spacer(),
          Text('\$${value.toStringAsFixed(2)}', style: style),
        ],
      ),
    );
  }
}

class _EmptyCartView extends StatelessWidget {
  const _EmptyCartView();

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.blueGrey.withOpacity(0.04),
        borderRadius: BorderRadius.circular(10),
      ),
      child: const Text(
        'Cart is empty.\nTap a product to add.',
        textAlign: TextAlign.center,
        style: TextStyle(color: Colors.black54),
      ),
    );
  }
}

/// UI-independent POS state and calculations.
class PosController extends ChangeNotifier {
  PosController({
    required List<PosProduct> products,
    required this.taxRate,
  }) : products = List<PosProduct>.unmodifiable(products);

  final List<PosProduct> products;
  final double taxRate;
  final Map<String, CartLine> _lineByProductId = <String, CartLine>{};

  UnmodifiableListView<CartLine> get cartItems =>
      UnmodifiableListView<CartLine>(_lineByProductId.values.toList());

  UnmodifiableMapView<String, int> get quantityByProduct {
    final Map<String, int> map = <String, int>{};
    for (final CartLine line in _lineByProductId.values) {
      map[line.product.id] = line.quantity;
    }
    return UnmodifiableMapView<String, int>(map);
  }

  bool canAddProduct(PosProduct product) {
    if (product.stockQty <= 0) return false;
    final CartLine? existing = _lineByProductId[product.id];
    if (existing == null) return true;
    return existing.quantity < product.stockQty;
  }

  void addProduct(PosProduct product) {
    if (!canAddProduct(product)) return;

    final CartLine? existing = _lineByProductId[product.id];
    if (existing == null) {
      _lineByProductId[product.id] = CartLine(product: product, quantity: 1);
    } else {
      existing.quantity += 1;
    }
    notifyListeners();
  }

  void incrementQuantity(PosProduct product) {
    addProduct(product);
  }

  void decrementQuantity(PosProduct product) {
    final CartLine? existing = _lineByProductId[product.id];
    if (existing == null) return;
    if (existing.quantity <= 1) {
      _lineByProductId.remove(product.id);
    } else {
      existing.quantity -= 1;
    }
    notifyListeners();
  }

  void removeLine(PosProduct product) {
    _lineByProductId.remove(product.id);
    notifyListeners();
  }

  double get subtotal => _lineByProductId.values.fold<double>(
        0,
        (double sum, CartLine line) => sum + line.lineTotal,
      );

  double get taxAmount => subtotal * taxRate;

  double get total => subtotal + taxAmount;
}

class PosProduct {
  const PosProduct({
    required this.id,
    required this.name,
    required this.price,
    required this.stockQty,
    required this.imageUrl,
  });

  final String id;
  final String name;
  final double price;
  final int stockQty;
  final String imageUrl;
}

class CartLine {
  CartLine({
    required this.product,
    required this.quantity,
  });

  final PosProduct product;
  int quantity;

  double get lineTotal => product.price * quantity;
}

class CheckoutPlaceholderScreen extends StatelessWidget {
  const CheckoutPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderNavScreen(title: 'Checkout');
  }
}

class PlaceholderNavScreen extends StatelessWidget {
  const PlaceholderNavScreen({
    super.key,
    required this.title,
  });

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        backgroundColor: Colors.white,
        foregroundColor: kPosPrimaryBlue,
        surfaceTintColor: Colors.white,
      ),
      body: Center(
        child: Text(
          '$title screen (placeholder)',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

const List<PosProduct> kMockProducts = <PosProduct>[
  PosProduct(
    id: 'p-001',
    name: 'Wireless Barcode Scanner',
    price: 49.99,
    stockQty: 22,
    imageUrl: 'https://picsum.photos/seed/pos001/420/300',
  ),
  PosProduct(
    id: 'p-002',
    name: 'Thermal Receipt Printer',
    price: 179.00,
    stockQty: 6,
    imageUrl: 'https://picsum.photos/seed/pos002/420/300',
  ),
  PosProduct(
    id: 'p-003',
    name: 'Cash Drawer (Metal)',
    price: 129.50,
    stockQty: 9,
    imageUrl: 'https://picsum.photos/seed/pos003/420/300',
  ),
  PosProduct(
    id: 'p-004',
    name: 'POS Terminal Stand',
    price: 69.00,
    stockQty: 17,
    imageUrl: 'https://picsum.photos/seed/pos004/420/300',
  ),
  PosProduct(
    id: 'p-005',
    name: 'NFC Card Reader',
    price: 99.99,
    stockQty: 14,
    imageUrl: 'https://picsum.photos/seed/pos005/420/300',
  ),
  PosProduct(
    id: 'p-006',
    name: 'Receipt Paper Roll (Pack)',
    price: 14.75,
    stockQty: 82,
    imageUrl: 'https://picsum.photos/seed/pos006/420/300',
  ),
  PosProduct(
    id: 'p-007',
    name: 'USB Numeric Keypad',
    price: 19.20,
    stockQty: 38,
    imageUrl: 'https://picsum.photos/seed/pos007/420/300',
  ),
  PosProduct(
    id: 'p-008',
    name: 'Customer Display Screen',
    price: 210.00,
    stockQty: 5,
    imageUrl: 'https://picsum.photos/seed/pos008/420/300',
  ),
  PosProduct(
    id: 'p-009',
    name: 'Label Printer',
    price: 155.40,
    stockQty: 11,
    imageUrl: 'https://picsum.photos/seed/pos009/420/300',
  ),
  PosProduct(
    id: 'p-010',
    name: 'Handheld Inventory Scanner',
    price: 88.00,
    stockQty: 27,
    imageUrl: 'https://picsum.photos/seed/pos010/420/300',
  ),
  PosProduct(
    id: 'p-011',
    name: 'Barcode Label Stickers',
    price: 12.80,
    stockQty: 120,
    imageUrl: 'https://picsum.photos/seed/pos011/420/300',
  ),
  PosProduct(
    id: 'p-012',
    name: 'POS Touch Monitor 15"',
    price: 299.00,
    stockQty: 8,
    imageUrl: 'https://picsum.photos/seed/pos012/420/300',
  ),
];
