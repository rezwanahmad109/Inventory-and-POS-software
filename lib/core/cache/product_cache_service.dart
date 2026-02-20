import 'package:hive_flutter/hive_flutter.dart';

class ProductCacheService {
  static const String _boxName = 'inventory_cache';
  static const String _productsKey = 'products.v1';

  Future<void> cacheProducts(List<Map<String, dynamic>> products) async {
    final Box<dynamic> box = await Hive.openBox<dynamic>(_boxName);
    await box.put(_productsKey, products);
  }

  Future<List<Map<String, dynamic>>> readCachedProducts() async {
    final Box<dynamic> box = await Hive.openBox<dynamic>(_boxName);
    final dynamic raw = box.get(_productsKey);
    if (raw is! List) {
      return const <Map<String, dynamic>>[];
    }

    return raw
        .whereType<Map>()
        .map(
          (Map value) => value.map(
            (dynamic key, dynamic entry) => MapEntry(
              key.toString(),
              entry,
            ),
          ),
        )
        .toList(growable: false);
  }
}
