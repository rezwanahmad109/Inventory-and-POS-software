import 'package:flutter_test/flutter_test.dart';

import '../lib/core/api/api_client.dart';
import '../lib/features/warehouse_operations/bloc/warehouse_operations_cubit.dart';
import '../lib/features/warehouse_operations/repository/warehouse_operations_repository.dart';

class _FakeWarehouseOperationsRepository extends WarehouseOperationsRepository {
  _FakeWarehouseOperationsRepository() : super(apiClient: _NoopApiClient());

  int loadStockCalls = 0;
  int createTransferCalls = 0;
  int postAdjustmentCalls = 0;
  String? lastWarehouseId;

  @override
  Future<List<WarehouseOption>> fetchWarehouses() async {
    return const <WarehouseOption>[
      WarehouseOption(id: 'wh-1', name: 'Main'),
      WarehouseOption(id: 'wh-2', name: 'Outlet'),
    ];
  }

  @override
  Future<List<ProductOption>> fetchProducts() async {
    return const <ProductOption>[
      ProductOption(
        id: 'prod-1',
        name: 'Label Printer',
        sku: 'LP-1',
        defaultWarehouseId: 'wh-1',
      ),
    ];
  }

  @override
  Future<List<WarehouseStockLevel>> fetchStockLevels({
    String? warehouseId,
  }) async {
    loadStockCalls += 1;
    lastWarehouseId = warehouseId;
    return const <WarehouseStockLevel>[
      WarehouseStockLevel(
        branchId: 'wh-1',
        branchName: 'Main',
        productId: 'prod-1',
        productName: 'Label Printer',
        sku: 'LP-1',
        stockQuantity: 4,
        stockValue: 200,
        lowStockThreshold: 2,
      ),
    ];
  }

  @override
  Future<List<StockTransferModel>> fetchTransfers() async {
    return const <StockTransferModel>[];
  }

  @override
  Future<void> createTransfer({
    required String fromBranchId,
    required String toBranchId,
    required String productId,
    required int quantity,
    String? note,
  }) async {
    createTransferCalls += 1;
  }

  @override
  Future<void> postStockAdjustment({
    required String productId,
    required int qtyDelta,
    required String reason,
    String? branchId,
    String? note,
  }) async {
    postAdjustmentCalls += 1;
  }
}

class _NoopApiClient extends ApiClient {
  _NoopApiClient();
}

void main() {
  group('WarehouseOperationsCubit', () {
    test('loadAll forwards selected warehouse filter', () async {
      final _FakeWarehouseOperationsRepository repository =
          _FakeWarehouseOperationsRepository();
      final WarehouseOperationsCubit cubit = WarehouseOperationsCubit(
        repository: repository,
      );

      await cubit.loadAll(warehouseId: 'wh-2');

      expect(repository.lastWarehouseId, 'wh-2');
      expect(cubit.state.selectedWarehouseId, 'wh-2');
      expect(cubit.state.totalStockValue, 200);
      await cubit.close();
    });

    test(
      'createTransfer requires source, destination, product, and positive quantity',
      () async {
        final _FakeWarehouseOperationsRepository repository =
            _FakeWarehouseOperationsRepository();
        final WarehouseOperationsCubit cubit = WarehouseOperationsCubit(
          repository: repository,
        );

        await cubit.createTransfer(
          fromBranchId: '',
          toBranchId: 'wh-2',
          productId: 'prod-1',
          quantity: 2,
        );

        expect(
          cubit.state.errorMessage,
          'Source, destination, and product are required.',
        );
        expect(repository.createTransferCalls, 0);
        await cubit.close();
      },
    );

    test('postAdjustment rejects zero quantity delta', () async {
      final _FakeWarehouseOperationsRepository repository =
          _FakeWarehouseOperationsRepository();
      final WarehouseOperationsCubit cubit = WarehouseOperationsCubit(
        repository: repository,
      );

      await cubit.postAdjustment(
        productId: 'prod-1',
        qtyDelta: 0,
        reason: 'stock_count',
      );

      expect(cubit.state.errorMessage, 'Adjustment delta cannot be zero.');
      expect(repository.postAdjustmentCalls, 0);
      await cubit.close();
    });

    test('createTransfer submits valid payload', () async {
      final _FakeWarehouseOperationsRepository repository =
          _FakeWarehouseOperationsRepository();
      final WarehouseOperationsCubit cubit = WarehouseOperationsCubit(
        repository: repository,
      );

      await cubit.createTransfer(
        fromBranchId: 'wh-1',
        toBranchId: 'wh-2',
        productId: 'prod-1',
        quantity: 3,
      );

      expect(repository.createTransferCalls, 1);
      await cubit.close();
    });
  });
}
