import '../repository/warehouse_operations_repository.dart';

const Object _warehouseUnset = Object();

class WarehouseOperationsState {
  const WarehouseOperationsState({
    required this.isLoading,
    required this.isSubmitting,
    required this.warehouses,
    required this.products,
    required this.stockLevels,
    required this.transfers,
    required this.selectedWarehouseId,
    this.errorMessage,
    this.successMessage,
  });

  factory WarehouseOperationsState.initial() {
    return const WarehouseOperationsState(
      isLoading: false,
      isSubmitting: false,
      warehouses: <WarehouseOption>[],
      products: <ProductOption>[],
      stockLevels: <WarehouseStockLevel>[],
      transfers: <StockTransferModel>[],
      selectedWarehouseId: null,
      errorMessage: null,
      successMessage: null,
    );
  }

  final bool isLoading;
  final bool isSubmitting;
  final List<WarehouseOption> warehouses;
  final List<ProductOption> products;
  final List<WarehouseStockLevel> stockLevels;
  final List<StockTransferModel> transfers;
  final String? selectedWarehouseId;
  final String? errorMessage;
  final String? successMessage;

  double get totalStockValue => stockLevels.fold<double>(
        0,
        (double sum, WarehouseStockLevel row) => sum + row.stockValue,
      );

  WarehouseOperationsState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    List<WarehouseOption>? warehouses,
    List<ProductOption>? products,
    List<WarehouseStockLevel>? stockLevels,
    List<StockTransferModel>? transfers,
    Object? selectedWarehouseId = _warehouseUnset,
    Object? errorMessage = _warehouseUnset,
    Object? successMessage = _warehouseUnset,
  }) {
    return WarehouseOperationsState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      warehouses: warehouses ?? this.warehouses,
      products: products ?? this.products,
      stockLevels: stockLevels ?? this.stockLevels,
      transfers: transfers ?? this.transfers,
      selectedWarehouseId: selectedWarehouseId == _warehouseUnset
          ? this.selectedWarehouseId
          : selectedWarehouseId as String?,
      errorMessage: errorMessage == _warehouseUnset
          ? this.errorMessage
          : errorMessage as String?,
      successMessage: successMessage == _warehouseUnset
          ? this.successMessage
          : successMessage as String?,
    );
  }
}
