import 'package:flutter_test/flutter_test.dart';

import '../lib/core/api/api_client.dart';
import '../lib/features/sales_operations/bloc/sales_operations_cubit.dart';
import '../lib/features/sales_operations/repository/sales_operations_repository.dart';

class _FakeSalesOperationsRepository extends SalesOperationsRepository {
  _FakeSalesOperationsRepository() : super(apiClient: _NoopApiClient());

  List<SalesDocumentModel> documents = <SalesDocumentModel>[];
  List<FinanceArInvoice> arInvoices = <FinanceArInvoice>[];
  List<FinanceWallet> wallets = <FinanceWallet>[];
  List<CustomerLookup> customers = <CustomerLookup>[];
  List<ProductLookup> products = <ProductLookup>[];

  int createOrderCalls = 0;
  int postDeliveryCalls = 0;
  int convertInvoiceCalls = 0;
  int allocatePaymentCalls = 0;

  List<Map<String, dynamic>> lastDeliveryItems = <Map<String, dynamic>>[];

  @override
  Future<List<SalesDocumentModel>> fetchSalesDocuments({
    String? documentType,
  }) async {
    return documents;
  }

  @override
  Future<List<FinanceArInvoice>> fetchArInvoices() async {
    return arInvoices;
  }

  @override
  Future<List<FinanceWallet>> fetchWallets() async {
    return wallets;
  }

  @override
  Future<List<CustomerLookup>> fetchCustomers() async {
    return customers;
  }

  @override
  Future<List<ProductLookup>> fetchProducts() async {
    return products;
  }

  @override
  Future<void> createSalesOrder({
    int? customerId,
    String? customerName,
    required List<CreateSalesOrderLineInput> items,
    String? notes,
  }) async {
    createOrderCalls += 1;
  }

  @override
  Future<void> postDelivery({
    required String orderId,
    required List<Map<String, dynamic>> items,
    String? note,
  }) async {
    postDeliveryCalls += 1;
    lastDeliveryItems = items;
  }

  @override
  Future<void> convertToInvoice({
    required String orderId,
    required List<Map<String, dynamic>> items,
    String? note,
  }) async {
    convertInvoiceCalls += 1;
  }

  @override
  Future<void> allocateArPayment({
    required String invoiceId,
    required String partyId,
    required String walletId,
    required double amount,
    String paymentMethod = 'bank_transfer',
  }) async {
    allocatePaymentCalls += 1;
  }
}

class _NoopApiClient extends ApiClient {
  _NoopApiClient();
}

SalesDocumentModel _buildQuotation({
  required String id,
  required DateTime createdAt,
  required String lineId,
}) {
  return SalesDocumentModel(
    id: id,
    invoiceNumber: 'SO-$id',
    documentType: 'quotation',
    status: 'draft',
    createdAt: createdAt,
    customerName: 'Customer A',
    dueTotal: 100,
    paidTotal: 0,
    items: <SalesDocumentLine>[
      SalesDocumentLine(
        id: lineId,
        productId: 'p-1',
        productName: 'Scanner',
        quantity: 5,
        deliveredQuantity: 2,
        invoicedQuantity: 1,
        unitPrice: 10,
      ),
    ],
    isOverdue: false,
    overdueDays: 0,
  );
}

void main() {
  group('SalesOperationsCubit', () {
    test(
      'loadAll selects latest quotation and seeds draft quantities',
      () async {
        final _FakeSalesOperationsRepository repository =
            _FakeSalesOperationsRepository();
        repository.documents = <SalesDocumentModel>[
          _buildQuotation(
            id: 'old',
            createdAt: DateTime(2026, 1, 1),
            lineId: 'line-old',
          ),
          SalesDocumentModel(
            id: 'inv-1',
            invoiceNumber: 'INV-1',
            documentType: 'invoice',
            status: 'issued',
            createdAt: DateTime(2026, 1, 15),
            customerName: 'Customer B',
            dueTotal: 0,
            paidTotal: 220,
            items: const <SalesDocumentLine>[],
            isOverdue: false,
            overdueDays: 0,
          ),
          _buildQuotation(
            id: 'new',
            createdAt: DateTime(2026, 2, 10),
            lineId: 'line-new',
          ),
        ];

        final SalesOperationsCubit cubit = SalesOperationsCubit(
          repository: repository,
        );
        await cubit.loadAll();

        expect(cubit.state.selectedOrderId, 'new');
        expect(cubit.state.deliveryDraftByLineId['line-new'], 0);
        expect(cubit.state.invoiceDraftByLineId['line-new'], 0);
        await cubit.close();
      },
    );

    test(
      'submitPartialDelivery posts only positive draft quantities',
      () async {
        final _FakeSalesOperationsRepository repository =
            _FakeSalesOperationsRepository();
        repository.documents = <SalesDocumentModel>[
          _buildQuotation(
            id: 'so-1',
            createdAt: DateTime(2026, 2, 1),
            lineId: 'line-1',
          ),
        ];

        final SalesOperationsCubit cubit = SalesOperationsCubit(
          repository: repository,
        );
        await cubit.loadAll();

        cubit.setDeliveryQty('line-1', 2);
        await cubit.submitPartialDelivery(note: 'Dispatch batch 1');

        expect(repository.postDeliveryCalls, 1);
        expect(repository.lastDeliveryItems, <Map<String, dynamic>>[
          <String, dynamic>{'orderItemId': 'line-1', 'quantity': 2},
        ]);
        await cubit.close();
      },
    );

    test('createSalesOrder rejects empty lines', () async {
      final _FakeSalesOperationsRepository repository =
          _FakeSalesOperationsRepository();
      final SalesOperationsCubit cubit = SalesOperationsCubit(
        repository: repository,
      );

      await cubit.createSalesOrder(lines: const <CreateSalesOrderLineInput>[]);

      expect(
        cubit.state.errorMessage,
        'Add at least one order line before saving.',
      );
      expect(repository.createOrderCalls, 0);
      await cubit.close();
    });

    test('allocatePayment blocks amount above invoice due', () async {
      final _FakeSalesOperationsRepository repository =
          _FakeSalesOperationsRepository();
      final SalesOperationsCubit cubit = SalesOperationsCubit(
        repository: repository,
      );

      const FinanceArInvoice invoice = FinanceArInvoice(
        id: 'ar-1',
        documentNo: 'INV-100',
        partyId: 'party-1',
        balanceDue: 50,
        totalAmount: 120,
        status: 'partial',
        dueDate: null,
      );

      await cubit.allocatePayment(
        invoice: invoice,
        walletId: 'wallet-1',
        amount: 75,
      );

      expect(
        cubit.state.errorMessage,
        'Allocation amount cannot exceed the invoice due balance.',
      );
      expect(repository.allocatePaymentCalls, 0);
      await cubit.close();
    });
  });
}
