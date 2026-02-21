import '../../../core/api/api_client.dart';

class WarehouseOption {
  const WarehouseOption({
    required this.id,
    required this.name,
  });

  final String id;
  final String name;
}

class WarehouseStockLevel {
  const WarehouseStockLevel({
    required this.branchId,
    required this.branchName,
    required this.productId,
    required this.productName,
    required this.sku,
    required this.stockQuantity,
    required this.stockValue,
    required this.lowStockThreshold,
  });

  final String branchId;
  final String branchName;
  final String productId;
  final String productName;
  final String sku;
  final int stockQuantity;
  final double stockValue;
  final int lowStockThreshold;

  double get averageCost {
    if (stockQuantity <= 0) {
      return 0;
    }
    return stockValue / stockQuantity;
  }
}

class StockTransferModel {
  const StockTransferModel({
    required this.id,
    required this.fromBranchId,
    required this.fromBranchName,
    required this.toBranchId,
    required this.toBranchName,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.status,
    required this.timestamp,
    required this.costSnapshot,
  });

  final String id;
  final String fromBranchId;
  final String fromBranchName;
  final String toBranchId;
  final String toBranchName;
  final String productId;
  final String productName;
  final int quantity;
  final String status;
  final DateTime? timestamp;
  final List<TransferCostLayer> costSnapshot;
}

class TransferCostLayer {
  const TransferCostLayer({
    required this.quantity,
    required this.unitCost,
  });

  final int quantity;
  final double unitCost;

  double get totalCost => quantity * unitCost;
}

class ProductOption {
  const ProductOption({
    required this.id,
    required this.name,
    required this.sku,
    required this.defaultWarehouseId,
  });

  final String id;
  final String name;
  final String sku;
  final String? defaultWarehouseId;
}

class WarehouseOperationsRepository {
  WarehouseOperationsRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<WarehouseOption>> fetchWarehouses() async {
    final dynamic response = await _apiClient.get('warehouses');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => WarehouseOption(
            id: row['id']?.toString() ?? '',
            name: row['name']?.toString() ?? 'Warehouse',
          ),
        )
        .where((WarehouseOption row) => row.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<List<ProductOption>> fetchProducts() async {
    final dynamic response = await _apiClient.get(
      'products',
      query: const <String, String>{'page': '1', 'limit': '100'},
    );
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => ProductOption(
            id: row['id']?.toString() ?? '',
            name: row['name']?.toString() ?? 'Product',
            sku: row['sku']?.toString() ?? '',
            defaultWarehouseId: row['defaultWarehouseId']?.toString(),
          ),
        )
        .where((ProductOption row) => row.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<List<WarehouseStockLevel>> fetchStockLevels({String? warehouseId}) async {
    final dynamic response = await _apiClient.get(
      'warehouses/stock-levels',
      query: <String, String>{
        if (warehouseId != null && warehouseId.trim().isNotEmpty)
          'warehouseId': warehouseId.trim(),
      },
    );
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => WarehouseStockLevel(
            branchId: row['branchId']?.toString() ?? '',
            branchName: row['branchName']?.toString() ?? 'Warehouse',
            productId: row['productId']?.toString() ?? '',
            productName: row['productName']?.toString() ?? 'Product',
            sku: row['sku']?.toString() ?? '',
            stockQuantity: _asInt(row['stockQuantity']),
            stockValue: _asDouble(row['stockValue']),
            lowStockThreshold: _asInt(row['lowStockThreshold']),
          ),
        )
        .toList(growable: false);
  }

  Future<List<StockTransferModel>> fetchTransfers() async {
    final dynamic response = await _apiClient.get('stock-transfers');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(_toTransfer)
        .toList(growable: false);
  }

  Future<void> createTransfer({
    required String fromBranchId,
    required String toBranchId,
    required String productId,
    required int quantity,
    String? note,
  }) async {
    await _apiClient.post(
      'stock-transfers',
      body: <String, dynamic>{
        'fromBranchId': fromBranchId,
        'toBranchId': toBranchId,
        'productId': productId,
        'quantity': quantity,
        if (note != null && note.trim().isNotEmpty) 'notes': note.trim(),
      },
    );
  }

  Future<void> approveTransfer(String transferId, {String? note}) async {
    await _apiClient.post(
      'stock-transfers/$transferId/approve',
      body: <String, dynamic>{
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }

  Future<void> receiveTransfer(String transferId, {String? note}) async {
    await _apiClient.post(
      'stock-transfers/$transferId/receive',
      body: <String, dynamic>{
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }

  Future<void> postStockAdjustment({
    required String productId,
    required int qtyDelta,
    required String reason,
    String? branchId,
    String? note,
  }) async {
    await _apiClient.post(
      'products/$productId/stock-adjustments',
      body: <String, dynamic>{
        'qtyDelta': qtyDelta,
        'reason': reason,
        if (branchId != null && branchId.trim().isNotEmpty) 'branchId': branchId.trim(),
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }

  List<dynamic> _extractRows(dynamic payload) {
    if (payload is List<dynamic>) {
      return payload;
    }
    if (payload is Map<String, dynamic>) {
      final dynamic rows = payload['items'] ?? payload['rows'] ?? payload['data'];
      if (rows is List<dynamic>) {
        return rows;
      }
      if (rows is Map<String, dynamic>) {
        final dynamic nestedRows = rows['items'] ?? rows['rows'];
        if (nestedRows is List<dynamic>) {
          return nestedRows;
        }
      }
    }
    return const <dynamic>[];
  }

  StockTransferModel _toTransfer(Map<String, dynamic> row) {
    final dynamic fromBranch = row['fromBranch'];
    final dynamic toBranch = row['toBranch'];
    final dynamic product = row['product'];
    final List<TransferCostLayer> costSnapshot = _extractRows(row['costSnapshot'])
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> item) => TransferCostLayer(
            quantity: _asInt(item['quantity']),
            unitCost: _asDouble(item['unitCost']),
          ),
        )
        .toList(growable: false);

    return StockTransferModel(
      id: row['id']?.toString() ?? '',
      fromBranchId: row['fromBranchId']?.toString() ?? '',
      fromBranchName: fromBranch is Map<String, dynamic>
          ? fromBranch['name']?.toString() ?? 'Source'
          : 'Source',
      toBranchId: row['toBranchId']?.toString() ?? '',
      toBranchName: toBranch is Map<String, dynamic>
          ? toBranch['name']?.toString() ?? 'Destination'
          : 'Destination',
      productId: row['productId']?.toString() ?? '',
      productName: product is Map<String, dynamic>
          ? product['name']?.toString() ?? 'Product'
          : 'Product',
      quantity: _asInt(row['quantity']),
      status: row['status']?.toString() ?? '',
      timestamp: _toDate(row['timestamp']),
      costSnapshot: costSnapshot,
    );
  }

  int _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  double _asDouble(dynamic value) {
    if (value is double) return value;
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  DateTime? _toDate(dynamic value) {
    final String raw = value?.toString() ?? '';
    if (raw.isEmpty) {
      return null;
    }
    return DateTime.tryParse(raw);
  }
}
