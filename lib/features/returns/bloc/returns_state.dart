import '../repository/returns_repository.dart';

const Object _returnsUnset = Object();

class ReturnsState {
  const ReturnsState({
    required this.module,
    required this.isLoading,
    required this.isSubmitting,
    required this.invoices,
    required this.returnQtyByProductId,
    required this.note,
    this.selectedInvoice,
    this.errorMessage,
    this.successMessage,
  });

  factory ReturnsState.initial(ReturnModuleType module) {
    return ReturnsState(
      module: module,
      isLoading: false,
      isSubmitting: false,
      invoices: const <ReturnInvoice>[],
      selectedInvoice: null,
      returnQtyByProductId: const <String, int>{},
      note: '',
      errorMessage: null,
      successMessage: null,
    );
  }

  final ReturnModuleType module;
  final bool isLoading;
  final bool isSubmitting;
  final List<ReturnInvoice> invoices;
  final ReturnInvoice? selectedInvoice;
  final Map<String, int> returnQtyByProductId;
  final String note;
  final String? errorMessage;
  final String? successMessage;

  bool get hasSelectedProducts =>
      returnQtyByProductId.values.any((int qty) => qty > 0);

  int selectedCountFor(String productId) =>
      returnQtyByProductId[productId] ?? 0;

  int maxCountFor(String productId) {
    final ReturnInvoice? invoice = selectedInvoice;
    if (invoice == null) return 0;
    for (final ReturnInvoiceItem item in invoice.items) {
      if (item.productId == productId) {
        return item.originalQuantity;
      }
    }
    return 0;
  }

  ReturnsState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    List<ReturnInvoice>? invoices,
    Object? selectedInvoice = _returnsUnset,
    Map<String, int>? returnQtyByProductId,
    String? note,
    Object? errorMessage = _returnsUnset,
    Object? successMessage = _returnsUnset,
  }) {
    return ReturnsState(
      module: module,
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      invoices: invoices ?? this.invoices,
      selectedInvoice: selectedInvoice == _returnsUnset
          ? this.selectedInvoice
          : selectedInvoice as ReturnInvoice?,
      returnQtyByProductId: returnQtyByProductId ?? this.returnQtyByProductId,
      note: note ?? this.note,
      errorMessage: errorMessage == _returnsUnset
          ? this.errorMessage
          : errorMessage as String?,
      successMessage: successMessage == _returnsUnset
          ? this.successMessage
          : successMessage as String?,
    );
  }
}
