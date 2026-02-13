import '../../../core/api/api_client.dart';

enum ReturnModuleType { sales, purchase }

class ReturnInvoice {
  const ReturnInvoice({
    required this.id,
    required this.invoiceNumber,
    required this.items,
    this.createdAt,
  });

  final String id;
  final String invoiceNumber;
  final List<ReturnInvoiceItem> items;
  final DateTime? createdAt;
}

class ReturnInvoiceItem {
  const ReturnInvoiceItem({
    required this.productId,
    required this.productName,
    required this.originalQuantity,
    required this.unitPrice,
  });

  final String productId;
  final String productName;
  final int originalQuantity;
  final double unitPrice;
}

class ReturnSubmitItem {
  const ReturnSubmitItem({required this.productId, required this.quantity});

  final String productId;
  final int quantity;
}

class ReturnsRepository {
  ReturnsRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<ReturnInvoice>> fetchInvoices(ReturnModuleType module) async {
    final String path = module == ReturnModuleType.sales
        ? 'sales'
        : 'purchases';
    final dynamic response = await _apiClient.get(path);
    final List<dynamic> rows = _extractCollection(response);

    return rows
        .whereType<Map<String, dynamic>>()
        .map((Map<String, dynamic> row) => _parseInvoice(row))
        .where((ReturnInvoice invoice) => invoice.items.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> submitReturn({
    required ReturnModuleType module,
    required String invoiceId,
    required List<ReturnSubmitItem> items,
    String? note,
  }) async {
    if (items.isEmpty) {
      throw const ApiException(400, 'Select at least one product to return.');
    }

    final Map<String, dynamic> payload = <String, dynamic>{
      module == ReturnModuleType.sales
              ? 'originalSaleId'
              : 'originalPurchaseId':
          invoiceId,
      'returnDate': DateTime.now().toIso8601String(),
      'items': items
          .map(
            (ReturnSubmitItem item) => <String, dynamic>{
              'productId': item.productId,
              'quantity': item.quantity,
            },
          )
          .toList(growable: false),
    };

    // Backend DTO does not currently accept "note", so keep it UI-only.
    final List<String> paths = module == ReturnModuleType.sales
        ? const <String>['sales-returns', 'sales-return']
        : const <String>['purchase-returns', 'purchase-return'];

    await _postWithFallback(paths, payload);
  }

  Future<dynamic> _postWithFallback(
    List<String> paths,
    Map<String, dynamic> payload,
  ) async {
    ApiException? lastError;

    for (final String path in paths) {
      try {
        return await _apiClient.post(path, body: payload);
      } on ApiException catch (error) {
        lastError = error;
        if (error.statusCode != 404) {
          rethrow;
        }
      }
    }

    throw lastError ?? const ApiException(500, 'Failed to submit return.');
  }

  ReturnInvoice _parseInvoice(Map<String, dynamic> row) {
    final String invoiceId = _asString(row['id']);
    final String invoiceNumber = _asString(row['invoiceNumber']).isNotEmpty
        ? _asString(row['invoiceNumber'])
        : 'Invoice $invoiceId';

    final DateTime? createdAt = _asDateTime(row['createdAt']);
    final dynamic rawItems = row['items'] ?? row['rows'] ?? <dynamic>[];
    final List<ReturnInvoiceItem> items = _parseItems(rawItems);

    return ReturnInvoice(
      id: invoiceId,
      invoiceNumber: invoiceNumber,
      items: items,
      createdAt: createdAt,
    );
  }

  List<ReturnInvoiceItem> _parseItems(dynamic rawItems) {
    if (rawItems is! List<dynamic>) {
      return const <ReturnInvoiceItem>[];
    }

    final List<ReturnInvoiceItem> items = <ReturnInvoiceItem>[];
    for (final dynamic row in rawItems) {
      if (row is! Map<String, dynamic>) {
        continue;
      }

      final Map<String, dynamic> product =
          row['product'] is Map<String, dynamic>
          ? row['product'] as Map<String, dynamic>
          : <String, dynamic>{};

      final String productId = _asString(row['productId']).isNotEmpty
          ? _asString(row['productId'])
          : _asString(product['id']);
      if (productId.isEmpty) {
        continue;
      }

      final int originalQuantity = _asInt(row['quantity']);
      if (originalQuantity <= 0) {
        continue;
      }

      final String productName = _asString(product['name']).isNotEmpty
          ? _asString(product['name'])
          : _asString(row['productName']);
      final double unitPrice = _asDouble(row['unitPrice']) > 0
          ? _asDouble(row['unitPrice'])
          : _asDouble(product['price']);

      items.add(
        ReturnInvoiceItem(
          productId: productId,
          productName: productName.isEmpty ? 'Unnamed Product' : productName,
          originalQuantity: originalQuantity,
          unitPrice: unitPrice,
        ),
      );
    }

    return items;
  }

  List<dynamic> _extractCollection(dynamic response) {
    if (response is List<dynamic>) {
      return response;
    }
    if (response is Map<String, dynamic>) {
      final dynamic collection =
          response['items'] ?? response['data'] ?? response['rows'];
      if (collection is List<dynamic>) {
        return collection;
      }
    }
    return const <dynamic>[];
  }

  String _asString(dynamic value) {
    return value?.toString().trim() ?? '';
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

  DateTime? _asDateTime(dynamic value) {
    if (value is String && value.isNotEmpty) {
      return DateTime.tryParse(value);
    }
    return null;
  }
}
