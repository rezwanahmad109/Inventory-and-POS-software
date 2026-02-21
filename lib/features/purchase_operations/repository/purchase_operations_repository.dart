import '../../../core/api/api_client.dart';

class SupplierModel {
  const SupplierModel({
    required this.id,
    required this.name,
    required this.contactName,
    required this.phone,
    required this.email,
  });

  final String id;
  final String name;
  final String? contactName;
  final String? phone;
  final String? email;
}

class WarehouseModel {
  const WarehouseModel({
    required this.id,
    required this.name,
  });

  final String id;
  final String name;
}

class PurchaseLineModel {
  const PurchaseLineModel({
    required this.id,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.warehouseId,
  });

  final String id;
  final String productId;
  final String productName;
  final int quantity;
  final double unitPrice;
  final String? warehouseId;
}

class PurchaseDocumentModel {
  const PurchaseDocumentModel({
    required this.id,
    required this.invoiceNumber,
    required this.documentType,
    required this.status,
    required this.supplierId,
    required this.supplierName,
    required this.grandTotal,
    required this.paidTotal,
    required this.dueTotal,
    required this.items,
  });

  final String id;
  final String invoiceNumber;
  final String documentType;
  final String status;
  final String supplierId;
  final String supplierName;
  final double grandTotal;
  final double paidTotal;
  final double dueTotal;
  final List<PurchaseLineModel> items;

  bool get isEstimate => documentType.toLowerCase() == 'estimate';
}

class ProductOption {
  const ProductOption({
    required this.id,
    required this.name,
    required this.sku,
    required this.price,
    required this.defaultWarehouseId,
  });

  final String id;
  final String name;
  final String sku;
  final double price;
  final String? defaultWarehouseId;
}

class CreatePurchaseLineInput {
  const CreatePurchaseLineInput({
    required this.productId,
    required this.quantity,
    required this.unitPrice,
    this.warehouseId,
  });

  final String productId;
  final int quantity;
  final double unitPrice;
  final String? warehouseId;
}

class PurchaseReturnModel {
  const PurchaseReturnModel({
    required this.id,
    required this.originalPurchaseId,
    required this.createdAt,
  });

  final String id;
  final String originalPurchaseId;
  final DateTime? createdAt;
}

class PurchaseOperationsRepository {
  PurchaseOperationsRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<SupplierModel>> fetchSuppliers() async {
    final dynamic response = await _apiClient.get('suppliers');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => SupplierModel(
            id: row['id']?.toString() ?? '',
            name: row['name']?.toString() ?? 'Supplier',
            contactName: row['contactName']?.toString(),
            phone: row['phone']?.toString(),
            email: row['email']?.toString(),
          ),
        )
        .where((SupplierModel supplier) => supplier.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> createSupplier({
    required String name,
    String? contactName,
    String? phone,
    String? email,
  }) async {
    await _apiClient.post(
      'suppliers',
      body: <String, dynamic>{
        'name': name.trim(),
        if (contactName != null && contactName.trim().isNotEmpty)
          'contactName': contactName.trim(),
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
        if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      },
    );
  }

  Future<List<PurchaseDocumentModel>> fetchPurchases() async {
    final dynamic response = await _apiClient.get(
      'purchases',
      query: const <String, String>{'page': '1', 'limit': '100'},
    );

    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(_toPurchaseDocument)
        .toList(growable: false);
  }

  Future<void> createPurchaseDocument({
    required String supplierId,
    required String documentType,
    required List<CreatePurchaseLineInput> lines,
    String? note,
  }) async {
    await _apiClient.post(
      'purchases',
      body: <String, dynamic>{
        'supplierId': supplierId,
        'documentType': documentType,
        'items': lines
            .map(
              (CreatePurchaseLineInput line) => <String, dynamic>{
                'productId': line.productId,
                'quantity': line.quantity,
                'unitPrice': line.unitPrice,
                if (line.warehouseId != null && line.warehouseId!.isNotEmpty)
                  'warehouseId': line.warehouseId,
              },
            )
            .toList(growable: false),
        if (note != null && note.trim().isNotEmpty) 'notes': note.trim(),
      },
    );
  }

  Future<void> convertEstimateToBill(String purchaseId, {String? note}) async {
    await _apiClient.post(
      'purchases/$purchaseId/convert',
      body: <String, dynamic>{
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }

  Future<void> recordSupplierPayment({
    required String purchaseId,
    required double amount,
    required String method,
    String? reference,
  }) async {
    await _apiClient.post(
      'purchases/$purchaseId/payments',
      body: <String, dynamic>{
        'amount': amount,
        'method': method,
        if (reference != null && reference.trim().isNotEmpty)
          'reference': reference.trim(),
      },
    );
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
            price: _asDouble(row['price']),
            defaultWarehouseId: row['defaultWarehouseId']?.toString(),
          ),
        )
        .where((ProductOption product) => product.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<List<WarehouseModel>> fetchWarehouses() async {
    final dynamic response = await _apiClient.get('warehouses');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => WarehouseModel(
            id: row['id']?.toString() ?? '',
            name: row['name']?.toString() ?? 'Warehouse',
          ),
        )
        .where((WarehouseModel warehouse) => warehouse.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<List<PurchaseReturnModel>> fetchPurchaseReturns() async {
    final dynamic response = await _apiClient.get('purchase-returns');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => PurchaseReturnModel(
            id: row['id']?.toString() ?? '',
            originalPurchaseId: row['originalPurchaseId']?.toString() ?? '',
            createdAt: _toDate(row['createdAt']),
          ),
        )
        .where((PurchaseReturnModel row) => row.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> createPurchaseReturn({
    required String originalPurchaseId,
    required List<Map<String, dynamic>> items,
    String? note,
  }) async {
    await _apiClient.post(
      'purchase-returns',
      body: <String, dynamic>{
        'originalPurchaseId': originalPurchaseId,
        'items': items,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }

  PurchaseDocumentModel _toPurchaseDocument(Map<String, dynamic> row) {
    final dynamic supplier = row['supplier'];
    final String supplierName = supplier is Map<String, dynamic>
        ? supplier['name']?.toString() ?? 'Supplier'
        : 'Supplier';
    final String supplierId = row['supplierId']?.toString() ?? '';

    final List<PurchaseLineModel> items = _extractRows(row['items'])
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> item) => PurchaseLineModel(
            id: item['id']?.toString() ?? '',
            productId: item['productId']?.toString() ?? '',
            productName: _resolveProductName(item),
            quantity: _asInt(item['quantity']),
            unitPrice: _asDouble(item['unitPrice']),
            warehouseId: item['warehouseId']?.toString(),
          ),
        )
        .toList(growable: false);

    return PurchaseDocumentModel(
      id: row['id']?.toString() ?? '',
      invoiceNumber: row['invoiceNumber']?.toString() ?? 'N/A',
      documentType: row['documentType']?.toString() ?? '',
      status: row['status']?.toString() ?? '',
      supplierId: supplierId,
      supplierName: supplierName,
      grandTotal: _asDouble(row['grandTotal']),
      paidTotal: _asDouble(row['paidTotal']),
      dueTotal: _asDouble(row['dueTotal']),
      items: items,
    );
  }

  String _resolveProductName(Map<String, dynamic> row) {
    final dynamic product = row['product'];
    if (product is Map<String, dynamic>) {
      final String name = product['name']?.toString() ?? '';
      if (name.trim().isNotEmpty) {
        return name;
      }
    }
    return row['productName']?.toString() ?? 'Product';
  }

  List<dynamic> _extractRows(dynamic payload) {
    if (payload is List<dynamic>) {
      return payload;
    }
    if (payload is Map<String, dynamic>) {
      final dynamic rows = payload['items'] ?? payload['data'] ?? payload['rows'];
      if (rows is List<dynamic>) {
        return rows;
      }
      if (rows is Map<String, dynamic>) {
        final dynamic nested = rows['items'] ?? rows['rows'];
        if (nested is List<dynamic>) {
          return nested;
        }
      }
    }
    return const <dynamic>[];
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
