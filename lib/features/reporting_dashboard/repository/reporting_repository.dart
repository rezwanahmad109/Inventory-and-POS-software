import '../../../core/api/api_client.dart';

class ChartPoint {
  const ChartPoint({
    required this.label,
    required this.value,
  });

  final String label;
  final double value;
}

class DashboardSummaryModel {
  const DashboardSummaryModel({
    required this.totalSalesToday,
    required this.totalSalesThisMonth,
    required this.totalDue,
    required this.netProfitThisMonth,
    required this.totalPurchasesToday,
    required this.totalPurchasesThisMonth,
    required this.totalExpensesToday,
    required this.totalExpensesThisMonth,
    required this.totalProducts,
    required this.lowStockItems,
    required this.totalCustomers,
    required this.salesChart,
    required this.paymentsChart,
  });

  final double totalSalesToday;
  final double totalSalesThisMonth;
  final double totalDue;
  final double netProfitThisMonth;
  final double totalPurchasesToday;
  final double totalPurchasesThisMonth;
  final double totalExpensesToday;
  final double totalExpensesThisMonth;
  final int totalProducts;
  final int lowStockItems;
  final int totalCustomers;
  final List<ChartPoint> salesChart;
  final List<ChartPoint> paymentsChart;
}

class ArAgingBucket {
  const ArAgingBucket({
    required this.bucket,
    required this.amount,
  });

  final String bucket;
  final double amount;
}

class ExportResult {
  const ExportResult({
    required this.reportName,
    required this.format,
    required this.fileName,
    required this.downloadUrl,
  });

  final String reportName;
  final String format;
  final String fileName;
  final String downloadUrl;
}

class ReportingRepository {
  ReportingRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<DashboardSummaryModel> fetchDashboardSummary() async {
    final dynamic response = await _apiClient.get('dashboard/summary');
    if (response is! Map<String, dynamic>) {
      throw const ApiException(500, 'Unexpected dashboard payload.');
    }

    return DashboardSummaryModel(
      totalSalesToday: _asDouble(response['totalSalesToday']),
      totalSalesThisMonth: _asDouble(response['totalSalesThisMonth']),
      totalDue: _asDouble(response['totalDue']),
      netProfitThisMonth: _asDouble(response['netProfitThisMonth']),
      totalPurchasesToday: _asDouble(response['totalPurchasesToday']),
      totalPurchasesThisMonth: _asDouble(response['totalPurchasesThisMonth']),
      totalExpensesToday: _asDouble(response['totalExpensesToday']),
      totalExpensesThisMonth: _asDouble(response['totalExpensesThisMonth']),
      totalProducts: _asInt(response['totalProducts']),
      lowStockItems: _asInt(response['lowStockItems']),
      totalCustomers: _asInt(response['totalCustomers']),
      salesChart: _extractChart(response['salesChart']),
      paymentsChart: _extractChart(response['paymentsChart']),
    );
  }

  Future<Map<String, dynamic>> fetchProfitLoss({
    required DateTime from,
    required DateTime to,
  }) async {
    final dynamic response = await _apiClient.get(
      'reports/profit-loss',
      query: _dateQuery(from, to),
    );
    if (response is Map<String, dynamic>) {
      return response;
    }
    throw const ApiException(500, 'Unexpected P&L payload.');
  }

  Future<Map<String, dynamic>> fetchInventorySummary({
    required DateTime from,
    required DateTime to,
  }) async {
    final dynamic response = await _apiClient.get(
      'reports/inventory-summary',
      query: _dateQuery(from, to),
    );
    if (response is Map<String, dynamic>) {
      return response;
    }
    throw const ApiException(500, 'Unexpected inventory summary payload.');
  }

  Future<Map<String, dynamic>> fetchSalesSummary({
    required DateTime from,
    required DateTime to,
  }) async {
    final dynamic response = await _apiClient.get(
      'reports/sales-summary',
      query: _dateQuery(from, to),
    );
    if (response is Map<String, dynamic>) {
      return response;
    }
    throw const ApiException(500, 'Unexpected sales summary payload.');
  }

  Future<List<ArAgingBucket>> fetchArAging({int bucketSizeDays = 30}) async {
    final dynamic response = await _apiClient.get(
      'api/reports/ar-aging',
      query: <String, String>{'bucketSizeDays': '$bucketSizeDays'},
    );
    final List<dynamic> rows = _extractRows(response);
    return rows
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => ArAgingBucket(
            bucket: row['bucket']?.toString() ?? 'Unspecified',
            amount: _asDouble(row['amount']),
          ),
        )
        .toList(growable: false);
  }

  Future<List<Map<String, dynamic>>> fetchStockTransfersForMovement() async {
    final dynamic response = await _apiClient.get('stock-transfers');
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .toList(growable: false);
  }

  Future<List<Map<String, dynamic>>> fetchSalesInvoicesForOverdue() async {
    final dynamic response = await _apiClient.get(
      'sales',
      query: const <String, String>{
        'page': '1',
        'limit': '100',
        'documentType': 'invoice',
      },
    );
    return _extractRows(response)
        .whereType<Map<String, dynamic>>()
        .toList(growable: false);
  }

  Future<ExportResult> exportReport({
    required String endpoint,
    required DateTime from,
    required DateTime to,
    required String format,
  }) async {
    final dynamic response = await _apiClient.get(
      'reports/$endpoint',
      query: <String, String>{
        ..._dateQuery(from, to),
        'format': format,
      },
    );

    if (response is! Map<String, dynamic>) {
      throw const ApiException(500, 'Unexpected export response.');
    }

    return ExportResult(
      reportName: response['reportName']?.toString() ?? endpoint,
      format: response['format']?.toString() ?? format,
      fileName: response['fileName']?.toString() ?? '',
      downloadUrl: response['downloadUrl']?.toString() ?? '',
    );
  }

  Map<String, String> _dateQuery(DateTime from, DateTime to) {
    return <String, String>{
      'from': from.toIso8601String(),
      'to': to.toIso8601String(),
    };
  }

  List<ChartPoint> _extractChart(dynamic payload) {
    return _extractRows(payload)
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> row) => ChartPoint(
            label: row['label']?.toString() ?? '',
            value: _asDouble(row['value']),
          ),
        )
        .toList(growable: false);
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
}
