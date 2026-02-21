import '../repository/purchase_operations_repository.dart';

const Object _purchaseUnset = Object();

class PurchaseOperationsState {
  const PurchaseOperationsState({
    required this.isLoading,
    required this.isSubmitting,
    required this.suppliers,
    required this.purchases,
    required this.products,
    required this.warehouses,
    required this.purchaseReturns,
    this.errorMessage,
    this.successMessage,
  });

  factory PurchaseOperationsState.initial() {
    return const PurchaseOperationsState(
      isLoading: false,
      isSubmitting: false,
      suppliers: <SupplierModel>[],
      purchases: <PurchaseDocumentModel>[],
      products: <ProductOption>[],
      warehouses: <WarehouseModel>[],
      purchaseReturns: <PurchaseReturnModel>[],
      errorMessage: null,
      successMessage: null,
    );
  }

  final bool isLoading;
  final bool isSubmitting;
  final List<SupplierModel> suppliers;
  final List<PurchaseDocumentModel> purchases;
  final List<ProductOption> products;
  final List<WarehouseModel> warehouses;
  final List<PurchaseReturnModel> purchaseReturns;
  final String? errorMessage;
  final String? successMessage;

  List<PurchaseDocumentModel> get estimates => purchases
      .where((PurchaseDocumentModel row) => row.isEstimate)
      .toList(growable: false);

  List<PurchaseDocumentModel> get bills => purchases
      .where((PurchaseDocumentModel row) => !row.isEstimate)
      .toList(growable: false);

  PurchaseOperationsState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    List<SupplierModel>? suppliers,
    List<PurchaseDocumentModel>? purchases,
    List<ProductOption>? products,
    List<WarehouseModel>? warehouses,
    List<PurchaseReturnModel>? purchaseReturns,
    Object? errorMessage = _purchaseUnset,
    Object? successMessage = _purchaseUnset,
  }) {
    return PurchaseOperationsState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      suppliers: suppliers ?? this.suppliers,
      purchases: purchases ?? this.purchases,
      products: products ?? this.products,
      warehouses: warehouses ?? this.warehouses,
      purchaseReturns: purchaseReturns ?? this.purchaseReturns,
      errorMessage: errorMessage == _purchaseUnset
          ? this.errorMessage
          : errorMessage as String?,
      successMessage: successMessage == _purchaseUnset
          ? this.successMessage
          : successMessage as String?,
    );
  }
}
