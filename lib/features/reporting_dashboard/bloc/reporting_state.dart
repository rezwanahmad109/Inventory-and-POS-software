import '../repository/reporting_repository.dart';

const Object _reportUnset = Object();

class ReportingState {
  const ReportingState({
    required this.isLoading,
    required this.isExporting,
    required this.from,
    required this.to,
    required this.summary,
    required this.profitLoss,
    required this.inventorySummary,
    required this.salesSummary,
    required this.arAging,
    required this.overdueInvoices,
    required this.stockMovements,
    this.errorMessage,
    this.successMessage,
  });

  factory ReportingState.initial() {
    final DateTime now = DateTime.now();
    final DateTime from = DateTime(now.year, now.month, 1);
    return ReportingState(
      isLoading: false,
      isExporting: false,
      from: from,
      to: now,
      summary: null,
      profitLoss: const <String, dynamic>{},
      inventorySummary: const <String, dynamic>{},
      salesSummary: const <String, dynamic>{},
      arAging: const <ArAgingBucket>[],
      overdueInvoices: const <Map<String, dynamic>>[],
      stockMovements: const <Map<String, dynamic>>[],
      errorMessage: null,
      successMessage: null,
    );
  }

  final bool isLoading;
  final bool isExporting;
  final DateTime from;
  final DateTime to;
  final DashboardSummaryModel? summary;
  final Map<String, dynamic> profitLoss;
  final Map<String, dynamic> inventorySummary;
  final Map<String, dynamic> salesSummary;
  final List<ArAgingBucket> arAging;
  final List<Map<String, dynamic>> overdueInvoices;
  final List<Map<String, dynamic>> stockMovements;
  final String? errorMessage;
  final String? successMessage;

  ReportingState copyWith({
    bool? isLoading,
    bool? isExporting,
    DateTime? from,
    DateTime? to,
    Object? summary = _reportUnset,
    Map<String, dynamic>? profitLoss,
    Map<String, dynamic>? inventorySummary,
    Map<String, dynamic>? salesSummary,
    List<ArAgingBucket>? arAging,
    List<Map<String, dynamic>>? overdueInvoices,
    List<Map<String, dynamic>>? stockMovements,
    Object? errorMessage = _reportUnset,
    Object? successMessage = _reportUnset,
  }) {
    return ReportingState(
      isLoading: isLoading ?? this.isLoading,
      isExporting: isExporting ?? this.isExporting,
      from: from ?? this.from,
      to: to ?? this.to,
      summary: summary == _reportUnset ? this.summary : summary as DashboardSummaryModel?,
      profitLoss: profitLoss ?? this.profitLoss,
      inventorySummary: inventorySummary ?? this.inventorySummary,
      salesSummary: salesSummary ?? this.salesSummary,
      arAging: arAging ?? this.arAging,
      overdueInvoices: overdueInvoices ?? this.overdueInvoices,
      stockMovements: stockMovements ?? this.stockMovements,
      errorMessage: errorMessage == _reportUnset
          ? this.errorMessage
          : errorMessage as String?,
      successMessage: successMessage == _reportUnset
          ? this.successMessage
          : successMessage as String?,
    );
  }
}
