import '../../../core/api/api_client.dart';

class SalesDocumentLine {
  const SalesDocumentLine({
    required this.id,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.deliveredQuantity,
    required this.invoicedQuantity,
    required this.unitPrice,
    this.warehouseId,
  });

  final String id;
  final String productId;
  final String productName;
  final int quantity;
  final int deliveredQuantity;
  final int invoicedQuantity;
  final double unitPrice;
  final String? warehouseId;

  int get remainingToDeliver => (quantity - deliveredQuantity).clamp(0, quantity);

  int get remainingToInvoice => (deliveredQuantity - invoicedQuantity).clamp(0, deliveredQuantity);
}

class SalesDocumentModel {
  const SalesDocumentModel({
    required this.id,
    required this.invoiceNumber,
    required this.documentType,
    required this.status,
    required this.createdAt,
    required this.customerName,
    required this.dueTotal,
    required this.paidTotal,
    required this.items,
    required this.isOverdue,
    required this.overdueDays,
  });

  final String id;
  final String invoiceNumber;
  final String documentType;
  final String status;
  final DateTime? createdAt;
  final String customerName;
  final double dueTotal;
  final double paidTotal;
  final List<SalesDocumentLine> items;
  final bool isOverdue;
  final int overdueDays;

  bool get isQuotation => documentType.toLowerCase() == 'quotation';
}

class FinanceArInvoice {
  const FinanceArInvoice({
    required this.id,
    required this.documentNo,
    required this.partyId,
    required this.balanceDue,
    required this.totalAmount,
    required this.status,
    required this.dueDate,
  });

  final String id;
  final String documentNo;
  final String partyId;
  final double balanceDue;
  final double totalAmount;
  final String status;
  final DateTime? dueDate;
}

class FinanceWallet {
  const FinanceWallet({
    required this.id,
    required this.code,
    required this.name,
    required this.balance,
    required this.currency,
  });

  final String id;
  final String code;
  final String name;
  final double balance;
  final String currency;
}

class CustomerLookup {
  const CustomerLookup({
    required this.id,
    required this.name,
  });

  final int id;
  final String name;
}

class ProductLookup {
  const ProductLookup({
    required this.id,
    required this.name,
    required this.sku,
    required this.price,
    this.defaultWarehouseId,
  });

  final String id;
  final String name;
  final String sku;
  final double price;
  final String? defaultWarehouseId;
}

class CreateSalesOrderLineInput {
  const CreateSalesOrderLineInput({
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

class SalesOperationsRepository {
  SalesOperationsRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<SalesDocumentModel>> fetchSalesDocuments({
    String? documentType,
  }) async {
    final Map<String, String> query = <String, String>{
      'page': '1',
      'limit': '100',
      if (documentType != null && documentType.trim().isNotEmpty)
        'documentType': documentType.trim(),
    };

    final dynamic response = await _apiClient.get('sales', query: query);
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(_toSalesDocument)
        .toList(growable: false);
  }

  Future<void> createSalesOrder({
    int? customerId,
    String? customerName,
    required List<CreateSalesOrderLineInput> items,
    String? notes,
  }) async {
    final List<Map<String, dynamic>> payloadItems = items
        .map(
          (CreateSalesOrderLineInput item) => <String, dynamic>{
            'productId': item.productId,
            'quantity': item.quantity,
            'unitPriceOverride': item.unitPrice,
            if (item.warehouseId != null && item.warehouseId!.isNotEmpty)
              'warehouseId': item.warehouseId,
          },
        )
        .toList(growable: false);

    await _apiClient.post(
      'sales',
      body: <String, dynamic>{
        'documentType': 'quotation',
        if (customerId != null) 'customerId': customerId,
        if (customerName != null && customerName.trim().isNotEmpty)
          'customer': customerName.trim(),
        'items': payloadItems,
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
  }

  Future<void> postDelivery({
    required String orderId,
    required List<Map<String, dynamic>> items,
    String? note,
  }) async {
    await _apiClient.post(
      'sales/$orderId/deliveries',
      body: <String, dynamic>{
        'items': items
            .map(
              (Map<String, dynamic> row) => <String, dynamic>{
                'orderItemId': row['orderItemId'],
                'quantity': row['quantity'],
              },
            )
            .toList(growable: false),
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }

  Future<void> convertToInvoice({
    required String orderId,
    required List<Map<String, dynamic>> items,
    String? note,
  }) async {
    await _apiClient.post(
      'sales/$orderId/convert',
      body: <String, dynamic>{
        if (items.isNotEmpty)
          'items': items
              .map(
                (Map<String, dynamic> row) => <String, dynamic>{
                  'orderItemId': row['orderItemId'],
                  'quantity': row['quantity'],
                },
              )
              .toList(growable: false),
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }

  Future<List<FinanceArInvoice>> fetchArInvoices() async {
    final dynamic response = await _apiClient.get(
      'api/invoices',
      query: const <String, String>{
        'page': '1',
        'limit': '100',
        'documentType': 'sales_invoice',
      },
    );
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map((Map<String, dynamic> row) => FinanceArInvoice(
              id: row['id']?.toString() ?? '',
              documentNo: row['documentNo']?.toString() ?? 'N/A',
              partyId: row['partyId']?.toString() ?? '',
              balanceDue: _asDouble(row['balanceDue']),
              totalAmount: _asDouble(row['totalAmount']),
              status: row['status']?.toString() ?? '',
              dueDate: _toDate(row['dueDate']),
            ))
        .toList(growable: false);
  }

  Future<List<FinanceWallet>> fetchWallets() async {
    final dynamic response = await _apiClient.get('api/wallets');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => FinanceWallet(
            id: row['id']?.toString() ?? '',
            code: row['code']?.toString() ?? '',
            name: row['name']?.toString() ?? '',
            balance: _asDouble(row['balance']),
            currency: row['currency']?.toString() ?? 'USD',
          ),
        )
        .toList(growable: false);
  }

  Future<void> allocateArPayment({
    required String invoiceId,
    required String partyId,
    required String walletId,
    required double amount,
    String paymentMethod = 'bank_transfer',
  }) async {
    await _apiClient.post(
      'api/payments',
      body: <String, dynamic>{
        'partyId': partyId,
        'walletId': walletId,
        'direction': 'receipt',
        'amount': amount,
        'paymentMethod': paymentMethod,
        'allocations': <Map<String, dynamic>>[
          <String, dynamic>{
            'invoiceId': invoiceId,
            'allocatedAmount': amount,
          },
        ],
      },
    );
  }

  Future<List<CustomerLookup>> fetchCustomers() async {
    final dynamic response = await _apiClient.get(
      'customers',
      query: const <String, String>{'page': '1', 'limit': '100'},
    );

    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map((Map<String, dynamic> row) => CustomerLookup(
              id: _asInt(row['id']),
              name: row['name']?.toString() ?? 'Customer',
            ))
        .where((CustomerLookup customer) => customer.id > 0)
        .toList(growable: false);
  }

  Future<List<ProductLookup>> fetchProducts() async {
    final dynamic response = await _apiClient.get(
      'products',
      query: const <String, String>{'page': '1', 'limit': '100'},
    );
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => ProductLookup(
            id: row['id']?.toString() ?? '',
            name: row['name']?.toString() ?? 'Product',
            sku: row['sku']?.toString() ?? '',
            price: _asDouble(row['price']),
            defaultWarehouseId: row['defaultWarehouseId']?.toString(),
          ),
        )
        .where((ProductLookup product) => product.id.isNotEmpty)
        .toList(growable: false);
  }

  List<dynamic> _extractRows(dynamic payload) {
    if (payload is List<dynamic>) {
      return payload;
    }
    if (payload is Map<String, dynamic>) {
      final dynamic direct = payload['items'] ?? payload['data'] ?? payload['rows'];
      if (direct is List<dynamic>) {
        return direct;
      }
      if (payload['data'] is Map<String, dynamic>) {
        final Map<String, dynamic> nested = payload['data'] as Map<String, dynamic>;
        final dynamic nestedItems = nested['items'] ?? nested['rows'];
        if (nestedItems is List<dynamic>) {
          return nestedItems;
        }
      }
    }
    return const <dynamic>[];
  }

  SalesDocumentModel _toSalesDocument(Map<String, dynamic> row) {
    final List<SalesDocumentLine> items = _extractRows(row['items'])
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> item) => SalesDocumentLine(
            id: item['id']?.toString() ?? '',
            productId: item['productId']?.toString() ?? '',
            productName: _resolveProductName(item),
            quantity: _asInt(item['quantity']),
            deliveredQuantity: _asInt(item['deliveredQuantity']),
            invoicedQuantity: _asInt(item['invoicedQuantity']),
            unitPrice: _asDouble(item['unitPrice']),
            warehouseId: item['warehouseId']?.toString(),
          ),
        )
        .toList(growable: false);

    return SalesDocumentModel(
      id: row['id']?.toString() ?? '',
      invoiceNumber: row['invoiceNumber']?.toString() ?? 'N/A',
      documentType: row['documentType']?.toString() ?? '',
      status: row['status']?.toString() ?? '',
      createdAt: _toDate(row['createdAt']),
      customerName: _resolveCustomerName(row),
      dueTotal: _asDouble(row['dueTotal']),
      paidTotal: _asDouble(row['paidTotal']),
      items: items,
      isOverdue: row['isOverdue'] == true,
      overdueDays: _asInt(row['overdueDays']),
    );
  }

  String _resolveCustomerName(Map<String, dynamic> row) {
    final dynamic customerEntity = row['customerEntity'];
    if (customerEntity is Map<String, dynamic>) {
      final String customer = customerEntity['name']?.toString() ?? '';
      if (customer.trim().isNotEmpty) {
        return customer;
      }
    }
    final String direct = row['customer']?.toString() ?? '';
    return direct.trim().isEmpty ? 'Walk-in' : direct.trim();
  }

  String _resolveProductName(Map<String, dynamic> row) {
    final dynamic product = row['product'];
    if (product is Map<String, dynamic>) {
      final String fromRelation = product['name']?.toString() ?? '';
      if (fromRelation.trim().isNotEmpty) {
        return fromRelation.trim();
      }
    }
    return row['productName']?.toString() ?? 'Product';
  }

  double _asDouble(dynamic value) {
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  int _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  DateTime? _toDate(dynamic value) {
    final String raw = value?.toString() ?? '';
    if (raw.isEmpty) {
      return null;
    }
    return DateTime.tryParse(raw);
  }
}
