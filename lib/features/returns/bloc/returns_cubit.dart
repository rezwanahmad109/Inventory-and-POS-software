import 'package:flutter_bloc/flutter_bloc.dart';

import '../repository/returns_repository.dart';
import 'returns_state.dart';

class ReturnsCubit extends Cubit<ReturnsState> {
  ReturnsCubit({
    required ReturnModuleType module,
    required ReturnsRepository repository,
  }) : _repository = repository,
       super(ReturnsState.initial(module));

  final ReturnsRepository _repository;

  Future<void> loadInvoices() async {
    emit(
      state.copyWith(isLoading: true, errorMessage: null, successMessage: null),
    );

    try {
      final List<ReturnInvoice> invoices = await _repository.fetchInvoices(
        state.module,
      );
      final ReturnInvoice? selectedInvoice = invoices.isNotEmpty
          ? invoices.first
          : null;

      emit(
        state.copyWith(
          isLoading: false,
          invoices: invoices,
          selectedInvoice: selectedInvoice,
          returnQtyByProductId: _buildQuantitySeed(selectedInvoice),
        ),
      );
    } on Exception catch (error) {
      emit(state.copyWith(isLoading: false, errorMessage: error.toString()));
    }
  }

  void selectInvoice(String invoiceId) {
    ReturnInvoice? selected;
    for (final ReturnInvoice invoice in state.invoices) {
      if (invoice.id == invoiceId) {
        selected = invoice;
        break;
      }
    }
    if (selected == null) return;

    emit(
      state.copyWith(
        selectedInvoice: selected,
        returnQtyByProductId: _buildQuantitySeed(selected),
      ),
    );
  }

  void updateReturnQty(String productId, int rawQty) {
    final int maxQty = state.maxCountFor(productId);
    final int nextQty = rawQty < 0 ? 0 : (rawQty > maxQty ? maxQty : rawQty);

    final Map<String, int> nextMap = Map<String, int>.from(
      state.returnQtyByProductId,
    );
    nextMap[productId] = nextQty;
    emit(state.copyWith(returnQtyByProductId: nextMap));
  }

  void incrementQty(String productId) {
    final int current = state.selectedCountFor(productId);
    updateReturnQty(productId, current + 1);
  }

  void decrementQty(String productId) {
    final int current = state.selectedCountFor(productId);
    updateReturnQty(productId, current - 1);
  }

  void updateNote(String note) {
    emit(state.copyWith(note: note));
  }

  Future<void> submit() async {
    final ReturnInvoice? selectedInvoice = state.selectedInvoice;
    if (selectedInvoice == null) {
      emit(state.copyWith(errorMessage: 'Select an invoice first.'));
      return;
    }

    final List<ReturnSubmitItem> selectedItems = state
        .returnQtyByProductId
        .entries
        .where((MapEntry<String, int> entry) => entry.value > 0)
        .map(
          (MapEntry<String, int> entry) =>
              ReturnSubmitItem(productId: entry.key, quantity: entry.value),
        )
        .toList(growable: false);

    if (selectedItems.isEmpty) {
      emit(
        state.copyWith(
          errorMessage: 'Set return quantity for at least one product.',
        ),
      );
      return;
    }

    emit(
      state.copyWith(
        isSubmitting: true,
        errorMessage: null,
        successMessage: null,
      ),
    );

    try {
      await _repository.submitReturn(
        module: state.module,
        invoiceId: selectedInvoice.id,
        items: selectedItems,
        note: state.note.trim(),
      );

      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage:
              '${_moduleLabel(state.module)} return submitted successfully.',
          returnQtyByProductId: _buildQuantitySeed(selectedInvoice),
          note: '',
        ),
      );
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  void clearFeedback() {
    emit(state.copyWith(errorMessage: null, successMessage: null));
  }

  Map<String, int> _buildQuantitySeed(ReturnInvoice? invoice) {
    if (invoice == null) {
      return const <String, int>{};
    }

    final Map<String, int> seed = <String, int>{};
    for (final ReturnInvoiceItem item in invoice.items) {
      seed[item.productId] = 0;
    }
    return seed;
  }

  String _moduleLabel(ReturnModuleType module) {
    return module == ReturnModuleType.sales ? 'Sales' : 'Purchase';
  }
}
