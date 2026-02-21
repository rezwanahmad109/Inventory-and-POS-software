import 'package:flutter_test/flutter_test.dart';

import '../lib/core/api/api_client.dart';
import '../lib/features/reporting_dashboard/bloc/reporting_cubit.dart';
import '../lib/features/reporting_dashboard/repository/reporting_repository.dart';

class _FakeReportingRepository extends ReportingRepository {
  _FakeReportingRepository() : super(apiClient: _NoopApiClient());

  int loadCalls = 0;
  int exportCalls = 0;

  @override
  Future<DashboardSummaryModel> fetchDashboardSummary() async {
    loadCalls += 1;
    return const DashboardSummaryModel(
      totalSalesToday: 120,
      totalSalesThisMonth: 3000,
      totalDue: 250,
      netProfitThisMonth: 900,
      totalPurchasesToday: 50,
      totalPurchasesThisMonth: 1200,
      totalExpensesToday: 20,
      totalExpensesThisMonth: 420,
      totalProducts: 80,
      lowStockItems: 6,
      totalCustomers: 40,
      salesChart: <ChartPoint>[ChartPoint(label: 'Mon', value: 120)],
      paymentsChart: <ChartPoint>[ChartPoint(label: 'Mon', value: 90)],
    );
  }

  @override
  Future<Map<String, dynamic>> fetchProfitLoss({
    required DateTime from,
    required DateTime to,
  }) async {
    return <String, dynamic>{'netProfit': 900};
  }

  @override
  Future<Map<String, dynamic>> fetchInventorySummary({
    required DateTime from,
    required DateTime to,
  }) async {
    return <String, dynamic>{'totalValue': 10000};
  }

  @override
  Future<Map<String, dynamic>> fetchSalesSummary({
    required DateTime from,
    required DateTime to,
  }) async {
    return <String, dynamic>{'invoiceCount': 12};
  }

  @override
  Future<List<ArAgingBucket>> fetchArAging({int bucketSizeDays = 30}) async {
    return const <ArAgingBucket>[
      ArAgingBucket(bucket: '0-30', amount: 200),
      ArAgingBucket(bucket: '31-60', amount: 50),
    ];
  }

  @override
  Future<List<Map<String, dynamic>>> fetchSalesInvoicesForOverdue() async {
    return <Map<String, dynamic>>[
      <String, dynamic>{'id': 'inv-1', 'isOverdue': true},
      <String, dynamic>{'id': 'inv-2', 'isOverdue': false},
    ];
  }

  @override
  Future<List<Map<String, dynamic>>> fetchStockTransfersForMovement() async {
    return <Map<String, dynamic>>[
      <String, dynamic>{'id': 'tx-1', 'quantity': 4},
    ];
  }

  @override
  Future<ExportResult> exportReport({
    required String endpoint,
    required DateTime from,
    required DateTime to,
    required String format,
  }) async {
    exportCalls += 1;
    return ExportResult(
      reportName: endpoint,
      format: format,
      fileName: 'report.$format',
      downloadUrl: 'https://example.test/report.$format',
    );
  }
}

class _NoopApiClient extends ApiClient {
  _NoopApiClient();
}

void main() {
  group('ReportingCubit', () {
    test('load populates reports and keeps only overdue invoices', () async {
      final _FakeReportingRepository repository = _FakeReportingRepository();
      final ReportingCubit cubit = ReportingCubit(repository: repository);

      await cubit.load();

      expect(cubit.state.summary, isNotNull);
      expect(cubit.state.overdueInvoices.length, 1);
      expect(cubit.state.overdueInvoices.first['id'], 'inv-1');
      await cubit.close();
    });

    test('setDateRange updates range and reloads report data', () async {
      final _FakeReportingRepository repository = _FakeReportingRepository();
      final ReportingCubit cubit = ReportingCubit(repository: repository);
      final DateTime from = DateTime(2026, 1, 1);
      final DateTime to = DateTime(2026, 1, 31);

      await cubit.setDateRange(from, to);

      expect(cubit.state.from, from);
      expect(cubit.state.to, to);
      expect(repository.loadCalls, 1);
      await cubit.close();
    });

    test('exportReport creates success feedback', () async {
      final _FakeReportingRepository repository = _FakeReportingRepository();
      final ReportingCubit cubit = ReportingCubit(repository: repository);

      await cubit.exportReport(endpoint: 'profit-loss', format: 'csv');

      expect(repository.exportCalls, 1);
      expect(
        cubit.state.successMessage,
        contains('profit-loss exported as report.csv'),
      );
      await cubit.close();
    });
  });
}
