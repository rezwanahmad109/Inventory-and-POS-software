import 'package:flutter_bloc/flutter_bloc.dart';

import '../repository/warehouse_operations_repository.dart';
import 'warehouse_operations_state.dart';

class WarehouseOperationsCubit extends Cubit<WarehouseOperationsState> {
  WarehouseOperationsCubit({required WarehouseOperationsRepository repository})
      : _repository = repository,
        super(WarehouseOperationsState.initial());

  final WarehouseOperationsRepository _repository;

  Future<void> loadAll({String? warehouseId}) async {
    final String? activeWarehouseId = warehouseId ?? state.selectedWarehouseId;
    emit(
      state.copyWith(
        isLoading: true,
        selectedWarehouseId: activeWarehouseId,
        errorMessage: null,
        successMessage: null,
      ),
    );

    try {
      final List<dynamic> result = await Future.wait<dynamic>(<Future<dynamic>>[
        _repository.fetchWarehouses(),
        _repository.fetchProducts(),
        _repository.fetchStockLevels(warehouseId: activeWarehouseId),
        _repository.fetchTransfers(),
      ]);
      emit(
        state.copyWith(
          isLoading: false,
          warehouses: result[0] as List<WarehouseOption>,
          products: result[1] as List<ProductOption>,
          stockLevels: result[2] as List<WarehouseStockLevel>,
          transfers: result[3] as List<StockTransferModel>,
        ),
      );
    } on Exception catch (error) {
      emit(state.copyWith(isLoading: false, errorMessage: error.toString()));
    }
  }

  Future<void> createTransfer({
    required String fromBranchId,
    required String toBranchId,
    required String productId,
    required int quantity,
    String? note,
  }) async {
    if (fromBranchId.isEmpty || toBranchId.isEmpty || productId.isEmpty) {
      emit(state.copyWith(errorMessage: 'Source, destination, and product are required.'));
      return;
    }
    if (quantity <= 0) {
      emit(state.copyWith(errorMessage: 'Transfer quantity must be positive.'));
      return;
    }

    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.createTransfer(
        fromBranchId: fromBranchId,
        toBranchId: toBranchId,
        productId: productId,
        quantity: quantity,
        note: note,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Stock transfer request created.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> approveTransfer(String transferId, {String? note}) async {
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.approveTransfer(transferId, note: note);
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Transfer approved and stock deducted from source.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> receiveTransfer(String transferId, {String? note}) async {
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.receiveTransfer(transferId, note: note);
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Transfer received into destination warehouse.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> postAdjustment({
    required String productId,
    required int qtyDelta,
    required String reason,
    String? branchId,
    String? note,
  }) async {
    if (productId.trim().isEmpty) {
      emit(state.copyWith(errorMessage: 'Select a product.'));
      return;
    }
    if (qtyDelta == 0) {
      emit(state.copyWith(errorMessage: 'Adjustment delta cannot be zero.'));
      return;
    }

    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.postStockAdjustment(
        productId: productId,
        qtyDelta: qtyDelta,
        reason: reason,
        branchId: branchId,
        note: note,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Inventory adjustment posted.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  void clearFeedback() {
    emit(state.copyWith(errorMessage: null, successMessage: null));
  }
}
