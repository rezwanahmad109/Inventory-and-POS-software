import 'package:flutter_bloc/flutter_bloc.dart';

import '../repository/purchase_operations_repository.dart';
import 'purchase_operations_state.dart';

class PurchaseOperationsCubit extends Cubit<PurchaseOperationsState> {
  PurchaseOperationsCubit({required PurchaseOperationsRepository repository})
      : _repository = repository,
        super(PurchaseOperationsState.initial());

  final PurchaseOperationsRepository _repository;

  Future<void> loadAll() async {
    emit(state.copyWith(isLoading: true, errorMessage: null, successMessage: null));
    try {
      final List<dynamic> result = await Future.wait<dynamic>(<Future<dynamic>>[
        _repository.fetchSuppliers(),
        _repository.fetchPurchases(),
        _repository.fetchProducts(),
        _repository.fetchWarehouses(),
        _repository.fetchPurchaseReturns(),
      ]);

      emit(
        state.copyWith(
          isLoading: false,
          suppliers: result[0] as List<SupplierModel>,
          purchases: result[1] as List<PurchaseDocumentModel>,
          products: result[2] as List<ProductOption>,
          warehouses: result[3] as List<WarehouseModel>,
          purchaseReturns: result[4] as List<PurchaseReturnModel>,
        ),
      );
    } on Exception catch (error) {
      emit(state.copyWith(isLoading: false, errorMessage: error.toString()));
    }
  }

  Future<void> createSupplier({
    required String name,
    String? contactName,
    String? phone,
    String? email,
  }) async {
    if (name.trim().isEmpty) {
      emit(state.copyWith(errorMessage: 'Supplier name is required.'));
      return;
    }
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.createSupplier(
        name: name,
        contactName: contactName,
        phone: phone,
        email: email,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Supplier created successfully.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> createPurchaseDocument({
    required String supplierId,
    required String documentType,
    required List<CreatePurchaseLineInput> lines,
    String? note,
  }) async {
    if (supplierId.trim().isEmpty) {
      emit(state.copyWith(errorMessage: 'Select a supplier.'));
      return;
    }
    if (lines.isEmpty) {
      emit(state.copyWith(errorMessage: 'Add at least one line.'));
      return;
    }

    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.createPurchaseDocument(
        supplierId: supplierId,
        documentType: documentType,
        lines: lines,
        note: note,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: documentType == 'estimate'
              ? 'Purchase order created.'
              : 'Purchase invoice posted.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> convertEstimateToBill(String purchaseId, {String? note}) async {
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.convertEstimateToBill(purchaseId, note: note);
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'GRN/receiving completed and converted to bill.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> recordSupplierPayment({
    required String purchaseId,
    required double amount,
    required String method,
    String? reference,
  }) async {
    if (amount <= 0) {
      emit(state.copyWith(errorMessage: 'Amount must be greater than zero.'));
      return;
    }
    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.recordSupplierPayment(
        purchaseId: purchaseId,
        amount: amount,
        method: method,
        reference: reference,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Supplier payment recorded.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> createPurchaseReturn({
    required String originalPurchaseId,
    required List<Map<String, dynamic>> items,
    String? note,
  }) async {
    if (originalPurchaseId.trim().isEmpty) {
      emit(state.copyWith(errorMessage: 'Select a purchase invoice.'));
      return;
    }
    if (items.isEmpty) {
      emit(state.copyWith(errorMessage: 'Select at least one item to return.'));
      return;
    }

    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.createPurchaseReturn(
        originalPurchaseId: originalPurchaseId,
        items: items,
        note: note,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Purchase return submitted.',
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
