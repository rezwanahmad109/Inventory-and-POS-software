import 'package:flutter_test/flutter_test.dart';

import '../lib/core/api/api_client.dart';
import '../lib/features/purchase_operations/bloc/purchase_operations_cubit.dart';
import '../lib/features/purchase_operations/repository/purchase_operations_repository.dart';

class _FakePurchaseOperationsRepository extends PurchaseOperationsRepository {
  _FakePurchaseOperationsRepository() : super(apiClient: _NoopApiClient());

  int createSupplierCalls = 0;
  int createDocumentCalls = 0;
  int createReturnCalls = 0;
  int paymentCalls = 0;

  @override
  Future<List<SupplierModel>> fetchSuppliers() async {
    return const <SupplierModel>[
      SupplierModel(
        id: 'sup-1',
        name: 'Global Supplier',
        contactName: null,
        phone: null,
        email: null,
      ),
    ];
  }

  @override
  Future<List<PurchaseDocumentModel>> fetchPurchases() async {
    return const <PurchaseDocumentModel>[
      PurchaseDocumentModel(
        id: 'po-1',
        invoiceNumber: 'PO-100',
        documentType: 'estimate',
        status: 'open',
        supplierId: 'sup-1',
        supplierName: 'Global Supplier',
        grandTotal: 100,
        paidTotal: 0,
        dueTotal: 100,
        items: <PurchaseLineModel>[],
      ),
    ];
  }

  @override
  Future<List<ProductOption>> fetchProducts() async {
    return const <ProductOption>[
      ProductOption(
        id: 'prod-1',
        name: 'POS Paper',
        sku: 'P-1',
        price: 10,
        defaultWarehouseId: 'wh-1',
      ),
    ];
  }

  @override
  Future<List<WarehouseModel>> fetchWarehouses() async {
    return const <WarehouseModel>[
      WarehouseModel(id: 'wh-1', name: 'Main Warehouse'),
    ];
  }

  @override
  Future<List<PurchaseReturnModel>> fetchPurchaseReturns() async {
    return const <PurchaseReturnModel>[];
  }

  @override
  Future<void> createSupplier({
    required String name,
    String? contactName,
    String? phone,
    String? email,
  }) async {
    createSupplierCalls += 1;
  }

  @override
  Future<void> createPurchaseDocument({
    required String supplierId,
    required String documentType,
    required List<CreatePurchaseLineInput> lines,
    String? note,
  }) async {
    createDocumentCalls += 1;
  }

  @override
  Future<void> recordSupplierPayment({
    required String purchaseId,
    required double amount,
    required String method,
    String? reference,
  }) async {
    paymentCalls += 1;
  }

  @override
  Future<void> createPurchaseReturn({
    required String originalPurchaseId,
    required List<Map<String, dynamic>> items,
    String? note,
  }) async {
    createReturnCalls += 1;
  }
}

class _NoopApiClient extends ApiClient {
  _NoopApiClient();
}

void main() {
  group('PurchaseOperationsCubit', () {
    test(
      'loadAll hydrates suppliers, purchases, products, and warehouses',
      () async {
        final _FakePurchaseOperationsRepository repository =
            _FakePurchaseOperationsRepository();
        final PurchaseOperationsCubit cubit = PurchaseOperationsCubit(
          repository: repository,
        );

        await cubit.loadAll();

        expect(cubit.state.suppliers.length, 1);
        expect(cubit.state.purchases.length, 1);
        expect(cubit.state.products.length, 1);
        expect(cubit.state.warehouses.length, 1);
        await cubit.close();
      },
    );

    test('createPurchaseDocument validates supplier and lines', () async {
      final _FakePurchaseOperationsRepository repository =
          _FakePurchaseOperationsRepository();
      final PurchaseOperationsCubit cubit = PurchaseOperationsCubit(
        repository: repository,
      );

      await cubit.createPurchaseDocument(
        supplierId: '',
        documentType: 'estimate',
        lines: const <CreatePurchaseLineInput>[],
      );

      expect(cubit.state.errorMessage, 'Select a supplier.');
      expect(repository.createDocumentCalls, 0);
      await cubit.close();
    });

    test('recordSupplierPayment rejects non-positive amounts', () async {
      final _FakePurchaseOperationsRepository repository =
          _FakePurchaseOperationsRepository();
      final PurchaseOperationsCubit cubit = PurchaseOperationsCubit(
        repository: repository,
      );

      await cubit.recordSupplierPayment(
        purchaseId: 'po-1',
        amount: 0,
        method: 'bank_transfer',
      );

      expect(cubit.state.errorMessage, 'Amount must be greater than zero.');
      expect(repository.paymentCalls, 0);
      await cubit.close();
    });

    test('createPurchaseReturn requires selected items', () async {
      final _FakePurchaseOperationsRepository repository =
          _FakePurchaseOperationsRepository();
      final PurchaseOperationsCubit cubit = PurchaseOperationsCubit(
        repository: repository,
      );

      await cubit.createPurchaseReturn(
        originalPurchaseId: 'po-1',
        items: const <Map<String, dynamic>>[],
      );

      expect(cubit.state.errorMessage, 'Select at least one item to return.');
      expect(repository.createReturnCalls, 0);
      await cubit.close();
    });

    test('createSupplier calls repository on valid payload', () async {
      final _FakePurchaseOperationsRepository repository =
          _FakePurchaseOperationsRepository();
      final PurchaseOperationsCubit cubit = PurchaseOperationsCubit(
        repository: repository,
      );

      await cubit.createSupplier(name: 'Northwind Supplies');

      expect(repository.createSupplierCalls, 1);
      await cubit.close();
    });
  });
}
