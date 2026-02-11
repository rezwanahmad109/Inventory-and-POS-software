import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const Color _kCheckoutPrimaryBlue = Color(0xFF1F4FFF);
const Color _kCheckoutAccentGold = Color(0xFFD4AF37);

/// Checkout screen to finalize POS sales.
///
/// This version uses local state and mock data only (no backend calls).
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, this.cartItems});

  /// Optional incoming cart items from POS flow.
  /// If not passed, local mock items are used.
  final List<CheckoutItem>? cartItems;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  static const double _taxRate = 0.10;
  static const List<String> _paymentMethods = <String>[
    'Cash',
    'Card',
    'Mobile Payment',
  ];

  final TextEditingController _discountController = TextEditingController();
  final TextEditingController _amountReceivedController = TextEditingController();

  late final List<CheckoutItem> _items;
  String _selectedPaymentMethod = _paymentMethods.first;

  @override
  void initState() {
    super.initState();
    _items = List<CheckoutItem>.unmodifiable(
      widget.cartItems ?? _mockCartItems,
    );
  }

  @override
  void dispose() {
    _discountController.dispose();
    _amountReceivedController.dispose();
    super.dispose();
  }

  double get _subtotal => _items.fold<double>(
        0,
        (double sum, CheckoutItem item) => sum + item.lineTotal,
      );

  double get _tax => _subtotal * _taxRate;

  double get _discount {
    final double value = double.tryParse(_discountController.text.trim()) ?? 0;
    return value < 0 ? 0 : value;
  }

  double get _grandTotal => math.max(0, _subtotal + _tax - _discount);

  double get _amountReceived {
    final double value =
        double.tryParse(_amountReceivedController.text.trim()) ?? 0;
    return value < 0 ? 0 : value;
  }

  double get _changeToReturn => math.max(0, _amountReceived - _grandTotal);

  bool get _canConfirmSale => _amountReceived >= _grandTotal && _items.isNotEmpty;

  void _onConfirmSale() {
    if (!_canConfirmSale) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Amount received is lower than grand total.',
          ),
        ),
      );
      return;
    }

    // Placeholder success flow. Replace with API call in next phase.
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Sale confirmed via $_selectedPaymentMethod.',
        ),
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Checkout'),
        backgroundColor: Colors.white,
        foregroundColor: _kCheckoutPrimaryBlue,
        surfaceTintColor: Colors.white,
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final bool isWide = constraints.maxWidth >= 900;

            if (isWide) {
              return Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Expanded(flex: 6, child: _buildCartSummaryCard()),
                    const SizedBox(width: 16),
                    Expanded(flex: 4, child: _buildPaymentCard()),
                  ],
                ),
              );
            }

            return ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                _buildCartSummaryCard(),
                const SizedBox(height: 14),
                _buildPaymentCard(),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildCartSummaryCard() {
    return Card(
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text(
              'Cart Summary',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _items.length,
              separatorBuilder: (_, __) => const Divider(height: 10),
              itemBuilder: (BuildContext context, int index) {
                final CheckoutItem item = _items[index];
                return Row(
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            item.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            '${item.quantity} x \$${item.price.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: Colors.black54,
                              fontSize: 12.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text('\$${item.lineTotal.toStringAsFixed(2)}'),
                  ],
                );
              },
            ),
            const SizedBox(height: 14),
            const Divider(height: 1),
            const SizedBox(height: 10),
            _TotalRow(label: 'Subtotal', value: _subtotal),
            _TotalRow(label: 'Tax (10%)', value: _tax),
            _TotalRow(label: 'Discount', value: _discount),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: _kCheckoutAccentGold.withOpacity(0.15),
              ),
              child: _TotalRow(
                label: 'Grand Total',
                value: _grandTotal,
                emphasize: true,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentCard() {
    return Card(
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text(
              'Payment',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _selectedPaymentMethod,
              decoration: const InputDecoration(
                labelText: 'Payment Method',
                prefixIcon: Icon(Icons.payments_outlined),
              ),
              items: _paymentMethods
                  .map(
                    (String method) => DropdownMenuItem<String>(
                      value: method,
                      child: Text(method),
                    ),
                  )
                  .toList(growable: false),
              onChanged: (String? value) {
                if (value == null) return;
                setState(() => _selectedPaymentMethod = value);
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _discountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}$')),
              ],
              decoration: const InputDecoration(
                labelText: 'Discount (optional)',
                prefixIcon: Icon(Icons.discount_outlined),
                prefixText: '\$',
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _amountReceivedController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}$')),
              ],
              decoration: const InputDecoration(
                labelText: 'Amount Received',
                prefixIcon: Icon(Icons.attach_money_outlined),
                prefixText: '\$',
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 14),
            _TotalRow(label: 'Change to Return', value: _changeToReturn),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: _kCheckoutPrimaryBlue,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: _onConfirmSale,
                child: const Text('Confirm Sale'),
              ),
            ),
            const SizedBox(height: 6),
            Center(
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
            ),
          ],
        ),
      ),
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
      color: emphasize ? _kCheckoutAccentGold : Colors.black87,
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

class CheckoutItem {
  const CheckoutItem({
    required this.name,
    required this.quantity,
    required this.price,
  });

  final String name;
  final int quantity;
  final double price;

  double get lineTotal => quantity * price;
}

const List<CheckoutItem> _mockCartItems = <CheckoutItem>[
  CheckoutItem(
    name: 'Wireless Barcode Scanner',
    quantity: 1,
    price: 49.99,
  ),
  CheckoutItem(
    name: 'Thermal Receipt Printer',
    quantity: 1,
    price: 179.00,
  ),
  CheckoutItem(
    name: 'Receipt Paper Roll (Pack)',
    quantity: 2,
    price: 14.75,
  ),
];
