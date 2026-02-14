import 'package:flutter_test/flutter_test.dart';
import '../lib/screens/inventory_list_screen.dart';

void main() {
  test('Product is low-stock when stock equals threshold', () {
    const product = Product(
      id: 'product-1',
      sku: 'SKU-1001',
      name: 'Thermal Printer',
      category: 'Hardware',
      unitPrice: 179.0,
      stockQty: 8,
      lowStockThreshold: 8,
    );

    expect(product.isLowStock, isTrue);
  });

  test('Product is not low-stock when threshold is zero', () {
    const product = Product(
      id: 'product-2',
      sku: 'SKU-1002',
      name: 'Receipt Roll',
      category: 'Consumables',
      unitPrice: 4.99,
      stockQty: 3,
      lowStockThreshold: 0,
    );

    expect(product.isLowStock, isFalse);
  });
}
