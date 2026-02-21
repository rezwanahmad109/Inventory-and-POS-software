import 'package:flutter_bloc/flutter_bloc.dart';

import '../repository/reporting_repository.dart';
import 'reporting_state.dart';

class ReportingCubit extends Cubit<ReportingState> {
  ReportingCubit({required ReportingRepository repository})
      : _repository = repository,
        super(ReportingState.initial());

  final ReportingRepository _repository;

  Future<void> load() async {
    emit(state.copyWith(isLoading: true, errorMessage: null, successMessage: null));
    try {
      final List<dynamic> result = await Future.wait<dynamic>(<Future<dynamic>>[
        _repository.fetchDashboardSummary(),
        _repository.fetchProfitLoss(from: state.from, to: state.to),
        _repository.fetchInventorySummary(from: state.from, to: state.to),
        _repository.fetchSalesSummary(from: state.from, to: state.to),
        _repository.fetchArAging(),
        _repository.fetchSalesInvoicesForOverdue(),
        _repository.fetchStockTransfersForMovement(),
      ]);

      final List<Map<String, dynamic>> overdueInvoices = (result[5] as List<Map<String, dynamic>>)
          .where((Map<String, dynamic> row) => row['isOverdue'] == true)
          .toList(growable: false);

      emit(
        state.copyWith(
          isLoading: false,
          summary: result[0] as DashboardSummaryModel,
          profitLoss: result[1] as Map<String, dynamic>,
          inventorySummary: result[2] as Map<String, dynamic>,
          salesSummary: result[3] as Map<String, dynamic>,
          arAging: result[4] as List<ArAgingBucket>,
          overdueInvoices: overdueInvoices,
          stockMovements: result[6] as List<Map<String, dynamic>>,
        ),
      );
    } on Exception catch (error) {
      emit(state.copyWith(isLoading: false, errorMessage: error.toString()));
    }
  }

  Future<void> setDateRange(DateTime from, DateTime to) async {
    emit(state.copyWith(from: from, to: to));
    await load();
  }

  Future<void> exportReport({
    required String endpoint,
    required String format,
  }) async {
    emit(state.copyWith(isExporting: true, errorMessage: null, successMessage: null));
    try {
      final ExportResult result = await _repository.exportReport(
        endpoint: endpoint,
        from: state.from,
        to: state.to,
        format: format,
      );
      emit(
        state.copyWith(
          isExporting: false,
          successMessage:
              '${result.reportName} exported as ${result.fileName} (${result.format}).',
        ),
      );
    } on Exception catch (error) {
      emit(state.copyWith(isExporting: false, errorMessage: error.toString()));
    }
  }

  void clearFeedback() {
    emit(state.copyWith(errorMessage: null, successMessage: null));
  }
}
