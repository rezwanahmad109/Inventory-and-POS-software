import '../repository/sales_operations_repository.dart';

const Object _salesOpsUnset = Object();

class SalesOperationsState {
  const SalesOperationsState({
    required this.isLoading,
    required this.isSubmitting,
    required this.documents,
    required this.arInvoices,
    required this.wallets,
    required this.customers,
    required this.products,
    required this.deliveryDraftByLineId,
    required this.invoiceDraftByLineId,
    required this.selectedOrderId,
    this.errorMessage,
    this.successMessage,
  });

  factory SalesOperationsState.initial() {
    return const SalesOperationsState(
      isLoading: false,
      isSubmitting: false,
      documents: <SalesDocumentModel>[],
      arInvoices: <FinanceArInvoice>[],
      wallets: <FinanceWallet>[],
      customers: <CustomerLookup>[],
      products: <ProductLookup>[],
      deliveryDraftByLineId: <String, int>{},
      invoiceDraftByLineId: <String, int>{},
      selectedOrderId: null,
      errorMessage: null,
      successMessage: null,
    );
  }

  final bool isLoading;
  final bool isSubmitting;
  final List<SalesDocumentModel> documents;
  final List<FinanceArInvoice> arInvoices;
  final List<FinanceWallet> wallets;
  final List<CustomerLookup> customers;
  final List<ProductLookup> products;
  final Map<String, int> deliveryDraftByLineId;
  final Map<String, int> invoiceDraftByLineId;
  final String? selectedOrderId;
  final String? errorMessage;
  final String? successMessage;

  SalesDocumentModel? get selectedOrder {
    final String? orderId = selectedOrderId;
    if (orderId == null) {
      return null;
    }
    for (final SalesDocumentModel document in documents) {
      if (document.id == orderId) {
        return document;
      }
    }
    return null;
  }

  List<SalesDocumentModel> get quotations => documents
      .where((SalesDocumentModel document) => document.isQuotation)
      .toList(growable: false);

  List<SalesDocumentModel> get invoices => documents
      .where((SalesDocumentModel document) => !document.isQuotation)
      .toList(growable: false);

  SalesOperationsState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    List<SalesDocumentModel>? documents,
    List<FinanceArInvoice>? arInvoices,
    List<FinanceWallet>? wallets,
    List<CustomerLookup>? customers,
    List<ProductLookup>? products,
    Map<String, int>? deliveryDraftByLineId,
    Map<String, int>? invoiceDraftByLineId,
    Object? selectedOrderId = _salesOpsUnset,
    Object? errorMessage = _salesOpsUnset,
    Object? successMessage = _salesOpsUnset,
  }) {
    return SalesOperationsState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      documents: documents ?? this.documents,
      arInvoices: arInvoices ?? this.arInvoices,
      wallets: wallets ?? this.wallets,
      customers: customers ?? this.customers,
      products: products ?? this.products,
      deliveryDraftByLineId: deliveryDraftByLineId ?? this.deliveryDraftByLineId,
      invoiceDraftByLineId: invoiceDraftByLineId ?? this.invoiceDraftByLineId,
      selectedOrderId: selectedOrderId == _salesOpsUnset
          ? this.selectedOrderId
          : selectedOrderId as String?,
      errorMessage: errorMessage == _salesOpsUnset
          ? this.errorMessage
          : errorMessage as String?,
      successMessage: successMessage == _salesOpsUnset
          ? this.successMessage
          : successMessage as String?,
    );
  }
}
