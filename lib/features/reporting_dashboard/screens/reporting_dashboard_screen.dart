import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/api/api_client.dart';
import '../../../core/ui/feedback_panel.dart';
import '../../../core/ui/offline_status_banner.dart';
import '../bloc/reporting_cubit.dart';
import '../bloc/reporting_state.dart';
import '../repository/reporting_repository.dart';

class ReportingDashboardScreen extends StatelessWidget {
  const ReportingDashboardScreen({required this.apiClient, super.key});

  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ReportingCubit>(
      create: (_) => ReportingCubit(
        repository: ReportingRepository(apiClient: apiClient),
      )..load(),
      child: _ReportingDashboardView(apiClient: apiClient),
    );
  }
}

class _ReportingDashboardView extends StatelessWidget {
  const _ReportingDashboardView({required this.apiClient});

  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ReportingCubit, ReportingState>(
      listener: (BuildContext context, ReportingState state) {
        if (state.errorMessage != null && state.errorMessage!.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_cleanError(state.errorMessage!))),
          );
          context.read<ReportingCubit>().clearFeedback();
        }
        if (state.successMessage != null && state.successMessage!.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.successMessage!),
              backgroundColor: Colors.green.shade700,
            ),
          );
          context.read<ReportingCubit>().clearFeedback();
        }
      },
      builder: (BuildContext context, ReportingState state) {
        return Scaffold(
          appBar: AppBar(
            title: const Text('Reporting Dashboard'),
            actions: <Widget>[
              IconButton(
                onPressed: state.isLoading
                    ? null
                    : () => context.read<ReportingCubit>().load(),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          body: OfflineStatusBanner(
            apiClient: apiClient,
            child: state.isLoading
                ? const Center(child: CircularProgressIndicator())
                : const _ReportingBody(),
          ),
        );
      },
    );
  }

  String _cleanError(String raw) {
    const String prefix = 'Exception:';
    return raw.startsWith(prefix) ? raw.substring(prefix.length).trim() : raw;
  }
}

class _ReportingBody extends StatelessWidget {
  const _ReportingBody();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReportingCubit, ReportingState>(
      builder: (BuildContext context, ReportingState state) {
        final DateTimeRange range = DateTimeRange(start: state.from, end: state.to);
        return ListView(
          padding: const EdgeInsets.all(12),
          children: <Widget>[
            _DateAndExportCard(range: range),
            const SizedBox(height: 10),
            _KpiCard(summary: state.summary),
            const SizedBox(height: 10),
            _TrendChartsCard(summary: state.summary),
            const SizedBox(height: 10),
            _ProfitLossCard(data: state.profitLoss),
            const SizedBox(height: 10),
            _ArAndOverdueCard(
              arAging: state.arAging,
              overdueInvoices: state.overdueInvoices,
            ),
            const SizedBox(height: 10),
            _InventoryAndMovementCard(
              inventorySummary: state.inventorySummary,
              stockMovements: state.stockMovements,
            ),
          ],
        );
      },
    );
  }
}

class _DateAndExportCard extends StatelessWidget {
  const _DateAndExportCard({required this.range});

  final DateTimeRange range;

  @override
  Widget build(BuildContext context) {
    final ReportingCubit cubit = context.read<ReportingCubit>();
    final ReportingState state = context.watch<ReportingCubit>().state;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text('Date Range & Export', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () async {
                final DateTime now = DateTime.now();
                final DateTimeRange? picked = await showDateRangePicker(
                  context: context,
                  firstDate: DateTime(now.year - 2),
                  lastDate: DateTime(now.year + 1),
                  initialDateRange: range,
                );
                if (picked == null) return;
                await cubit.setDateRange(picked.start, picked.end);
              },
              icon: const Icon(Icons.date_range_outlined),
              label: Text('${_dateLabel(range.start)} to ${_dateLabel(range.end)}'),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                FilledButton(
                  onPressed: state.isExporting
                      ? null
                      : () => cubit.exportReport(endpoint: 'profit-loss', format: 'csv'),
                  child: const Text('Export P&L CSV'),
                ),
                OutlinedButton(
                  onPressed: state.isExporting
                      ? null
                      : () =>
                          cubit.exportReport(endpoint: 'inventory-summary', format: 'csv'),
                  child: const Text('Export Inventory CSV'),
                ),
                OutlinedButton(
                  onPressed: state.isExporting
                      ? null
                      : () =>
                          cubit.exportReport(endpoint: 'sales-summary', format: 'pdf'),
                  child: const Text('Export Sales PDF'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.summary});

  final DashboardSummaryModel? summary;

  @override
  Widget build(BuildContext context) {
    if (summary == null) {
      return const FeedbackPanel(message: 'KPI summary unavailable.');
    }

    final List<_KpiRow> rows = <_KpiRow>[
      _KpiRow(label: 'Sales Today', value: summary!.totalSalesToday),
      _KpiRow(label: 'Sales This Month', value: summary!.totalSalesThisMonth),
      _KpiRow(label: 'Net Profit This Month', value: summary!.netProfitThisMonth),
      _KpiRow(label: 'Outstanding Due', value: summary!.totalDue),
      _KpiRow(label: 'Purchases This Month', value: summary!.totalPurchasesThisMonth),
      _KpiRow(label: 'Expenses This Month', value: summary!.totalExpensesThisMonth),
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: rows
              .map(
                (_KpiRow row) => SizedBox(
                  width: 220,
                  child: _KpiTile(label: row.label, value: row.value),
                ),
              )
              .toList(growable: false),
        ),
      ),
    );
  }
}

class _TrendChartsCard extends StatelessWidget {
  const _TrendChartsCard({required this.summary});

  final DashboardSummaryModel? summary;

  @override
  Widget build(BuildContext context) {
    if (summary == null) {
      return const SizedBox.shrink();
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text('Daily Trends', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            _MiniChart(title: 'Daily Sales', points: summary!.salesChart),
            const SizedBox(height: 12),
            _MiniChart(title: 'Net Payments (In-Out)', points: summary!.paymentsChart),
          ],
        ),
      ),
    );
  }
}

class _ProfitLossCard extends StatelessWidget {
  const _ProfitLossCard({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const FeedbackPanel(message: 'Profit & loss report unavailable.');
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text('P&L', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            _MetricRow(label: 'Sales', value: _asDouble(data['totalSales'])),
            _MetricRow(label: 'Purchases', value: _asDouble(data['totalPurchases'])),
            _MetricRow(label: 'Expenses', value: _asDouble(data['totalExpenses'])),
            const Divider(),
            _MetricRow(
              label: 'Net Profit',
              value: _asDouble(data['netProfit']),
              emphasize: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _ArAndOverdueCard extends StatelessWidget {
  const _ArAndOverdueCard({
    required this.arAging,
    required this.overdueInvoices,
  });

  final List<ArAgingBucket> arAging;
  final List<Map<String, dynamic>> overdueInvoices;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text('Overdue & AR Aging', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (arAging.isEmpty)
              const Text('No AR aging buckets available.')
            else
              ...arAging.map(
                (ArAgingBucket row) =>
                    _MetricRow(label: row.bucket, value: row.amount),
              ),
            const Divider(),
            Text('Overdue invoices: ${overdueInvoices.length}'),
            const SizedBox(height: 6),
            if (overdueInvoices.isNotEmpty)
              ...overdueInvoices.take(8).map(
                (Map<String, dynamic> row) => Text(
                  '${row['invoiceNumber'] ?? 'N/A'} | Due \$${_asDouble(row['dueTotal']).toStringAsFixed(2)} | ${row['overdueDays'] ?? 0} days',
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _InventoryAndMovementCard extends StatelessWidget {
  const _InventoryAndMovementCard({
    required this.inventorySummary,
    required this.stockMovements,
  });

  final Map<String, dynamic> inventorySummary;
  final List<Map<String, dynamic>> stockMovements;

  @override
  Widget build(BuildContext context) {
    final List<dynamic> lowStock = inventorySummary['lowStockItems'] is List<dynamic>
        ? inventorySummary['lowStockItems'] as List<dynamic>
        : const <dynamic>[];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'Inventory Ageing & Stock Movement',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text('Inventory value: \$${_asDouble(inventorySummary['totalValue']).toStringAsFixed(2)}'),
            Text('Low-stock items: ${lowStock.length}'),
            const SizedBox(height: 8),
            const Text(
              'Inventory ageing currently uses low-stock and recent movement as operational proxy.',
            ),
            const SizedBox(height: 8),
            Text('Recent stock transfers: ${stockMovements.length}'),
            if (stockMovements.isNotEmpty)
              ...stockMovements.take(8).map(
                (Map<String, dynamic> row) => Text(
                  '${row['product'] is Map<String, dynamic> ? row['product']['name'] : row['productId']} | ${row['status']} | Qty ${row['quantity']}',
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MiniChart extends StatelessWidget {
  const _MiniChart({
    required this.title,
    required this.points,
  });

  final String title;
  final List<ChartPoint> points;

  @override
  Widget build(BuildContext context) {
    final double maxValue = points.fold<double>(
      0,
      (double current, ChartPoint row) => row.value > current ? row.value : current,
    );
    final double baseline = maxValue <= 0 ? 1 : maxValue;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(title, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 6),
        if (points.isEmpty) const Text('No data'),
        ...points.map(
          (ChartPoint row) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: <Widget>[
                SizedBox(width: 88, child: Text(row.label, overflow: TextOverflow.ellipsis)),
                Expanded(
                  child: LinearProgressIndicator(value: row.value / baseline),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 74,
                  child: Text(
                    row.value.toStringAsFixed(2),
                    textAlign: TextAlign.right,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.label,
    required this.value,
  });

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary.withOpacity(0.06),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label),
          const SizedBox(height: 6),
          Text(
            '\$${value.toStringAsFixed(2)}',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({
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
      fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500,
      fontSize: emphasize ? 16 : 14,
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

class _KpiRow {
  const _KpiRow({
    required this.label,
    required this.value,
  });

  final String label;
  final double value;
}

double _asDouble(dynamic value) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

String _dateLabel(DateTime date) {
  final DateTime local = date.toLocal();
  final String month = local.month.toString().padLeft(2, '0');
  final String day = local.day.toString().padLeft(2, '0');
  return '${local.year}-$month-$day';
}
