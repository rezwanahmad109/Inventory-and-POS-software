import 'package:flutter_bloc/flutter_bloc.dart';

import '../repository/sales_operations_repository.dart';
import 'sales_operations_state.dart';

class SalesOperationsCubit extends Cubit<SalesOperationsState> {
  SalesOperationsCubit({required SalesOperationsRepository repository})
      : _repository = repository,
        super(SalesOperationsState.initial());

  final SalesOperationsRepository _repository;

  Future<void> loadAll() async {
    emit(
      state.copyWith(
        isLoading: true,
        errorMessage: null,
        successMessage: null,
      ),
    );

    try {
      final List<dynamic> result = await Future.wait<dynamic>(<Future<dynamic>>[
        _repository.fetchSalesDocuments(),
        _repository.fetchArInvoices(),
        _repository.fetchWallets(),
        _repository.fetchCustomers(),
        _repository.fetchProducts(),
      ]);

      final List<SalesDocumentModel> documents = (result[0] as List<SalesDocumentModel>)
        ..sort((SalesDocumentModel a, SalesDocumentModel b) {
          final DateTime aDate = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          final DateTime bDate = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          return bDate.compareTo(aDate);
        });
      final List<FinanceArInvoice> arInvoices = (result[1] as List<FinanceArInvoice>)
        ..sort((FinanceArInvoice a, FinanceArInvoice b) => b.balanceDue.compareTo(a.balanceDue));
      final List<FinanceWallet> wallets = result[2] as List<FinanceWallet>;
      final List<CustomerLookup> customers = result[3] as List<CustomerLookup>;
      final List<ProductLookup> products = result[4] as List<ProductLookup>;

      final String? selectedOrderId = _resolveSelectedOrderId(documents);
      emit(
        state.copyWith(
          isLoading: false,
          documents: documents,
          arInvoices: arInvoices,
          wallets: wallets,
          customers: customers,
          products: products,
          selectedOrderId: selectedOrderId,
          deliveryDraftByLineId: _seedDraftMap(documents, selectedOrderId, isInvoice: false),
          invoiceDraftByLineId: _seedDraftMap(documents, selectedOrderId, isInvoice: true),
          errorMessage: null,
        ),
      );
    } on Exception catch (error) {
      emit(
        state.copyWith(
          isLoading: false,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  void selectOrder(String? orderId) {
    if (orderId == null || orderId.isEmpty) {
      emit(
        state.copyWith(
          selectedOrderId: null,
          deliveryDraftByLineId: const <String, int>{},
          invoiceDraftByLineId: const <String, int>{},
        ),
      );
      return;
    }

    emit(
      state.copyWith(
        selectedOrderId: orderId,
        deliveryDraftByLineId: _seedDraftMap(state.documents, orderId, isInvoice: false),
        invoiceDraftByLineId: _seedDraftMap(state.documents, orderId, isInvoice: true),
      ),
    );
  }

  void setDeliveryQty(String lineId, int qty) {
    final SalesDocumentModel? order = state.selectedOrder;
    if (order == null) {
      return;
    }
    int maxQty = 0;
    for (final SalesDocumentLine line in order.items) {
      if (line.id == lineId) {
        maxQty = line.remainingToDeliver;
        break;
      }
    }
    final int nextQty = _sanitizeQty(qty, maxQty);

    final Map<String, int> draft = Map<String, int>.from(state.deliveryDraftByLineId);
    draft[lineId] = nextQty;
    emit(state.copyWith(deliveryDraftByLineId: draft));
  }

  void setInvoiceQty(String lineId, int qty) {
    final SalesDocumentModel? order = state.selectedOrder;
    if (order == null) {
      return;
    }
    int maxQty = 0;
    for (final SalesDocumentLine line in order.items) {
      if (line.id == lineId) {
        maxQty = line.remainingToInvoice;
        break;
      }
    }
    final int nextQty = _sanitizeQty(qty, maxQty);

    final Map<String, int> draft = Map<String, int>.from(state.invoiceDraftByLineId);
    draft[lineId] = nextQty;
    emit(state.copyWith(invoiceDraftByLineId: draft));
  }

  Future<void> createSalesOrder({
    int? customerId,
    String? customerName,
    required List<CreateSalesOrderLineInput> lines,
    String? notes,
  }) async {
    if (lines.isEmpty) {
      emit(
        state.copyWith(
          errorMessage: 'Add at least one order line before saving.',
        ),
      );
      return;
    }

    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.createSalesOrder(
        customerId: customerId,
        customerName: customerName,
        items: lines,
        notes: notes,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Sales order created successfully.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(
        state.copyWith(
          isSubmitting: false,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  Future<void> submitPartialDelivery({String? note}) async {
    final SalesDocumentModel? order = state.selectedOrder;
    if (order == null) {
      emit(state.copyWith(errorMessage: 'Select an order first.'));
      return;
    }

    final List<Map<String, dynamic>> items = <Map<String, dynamic>>[];
    for (final SalesDocumentLine line in order.items) {
      final int qty = state.deliveryDraftByLineId[line.id] ?? 0;
      if (qty <= 0) {
        continue;
      }
      if (qty > line.remainingToDeliver) {
        emit(
          state.copyWith(
            errorMessage:
                'Delivery quantity for ${line.productName} exceeds remaining quantity.',
          ),
        );
        return;
      }
      items.add(<String, dynamic>{'orderItemId': line.id, 'quantity': qty});
    }

    if (items.isEmpty) {
      emit(state.copyWith(errorMessage: 'Enter delivery quantity for at least one line.'));
      return;
    }

    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.postDelivery(orderId: order.id, items: items, note: note);
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Partial delivery posted.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> submitPartialInvoice({String? note}) async {
    final SalesDocumentModel? order = state.selectedOrder;
    if (order == null) {
      emit(state.copyWith(errorMessage: 'Select an order first.'));
      return;
    }

    final List<Map<String, dynamic>> items = <Map<String, dynamic>>[];
    for (final SalesDocumentLine line in order.items) {
      final int qty = state.invoiceDraftByLineId[line.id] ?? 0;
      if (qty <= 0) {
        continue;
      }
      if (qty > line.remainingToInvoice) {
        emit(
          state.copyWith(
            errorMessage:
                'Invoice quantity for ${line.productName} exceeds delivered-uninvoiced quantity.',
          ),
        );
        return;
      }
      items.add(<String, dynamic>{'orderItemId': line.id, 'quantity': qty});
    }

    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.convertToInvoice(orderId: order.id, items: items, note: note);
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Invoice generated from order.',
        ),
      );
      await loadAll();
    } on Exception catch (error) {
      emit(state.copyWith(isSubmitting: false, errorMessage: error.toString()));
    }
  }

  Future<void> allocatePayment({
    required FinanceArInvoice invoice,
    required String walletId,
    required double amount,
    String paymentMethod = 'bank_transfer',
  }) async {
    if (walletId.trim().isEmpty) {
      emit(state.copyWith(errorMessage: 'Select a wallet for allocation.'));
      return;
    }
    if (amount <= 0) {
      emit(state.copyWith(errorMessage: 'Payment amount must be greater than zero.'));
      return;
    }
    if (amount > invoice.balanceDue) {
      emit(
        state.copyWith(
          errorMessage: 'Allocation amount cannot exceed the invoice due balance.',
        ),
      );
      return;
    }

    emit(state.copyWith(isSubmitting: true, errorMessage: null, successMessage: null));
    try {
      await _repository.allocateArPayment(
        invoiceId: invoice.id,
        partyId: invoice.partyId,
        walletId: walletId,
        amount: amount,
        paymentMethod: paymentMethod,
      );
      emit(
        state.copyWith(
          isSubmitting: false,
          successMessage: 'Payment allocated successfully.',
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

  String? _resolveSelectedOrderId(List<SalesDocumentModel> documents) {
    if (state.selectedOrderId != null) {
      for (final SalesDocumentModel document in documents) {
        if (document.id == state.selectedOrderId && document.isQuotation) {
          return document.id;
        }
      }
    }
    for (final SalesDocumentModel document in documents) {
      if (document.isQuotation) {
        return document.id;
      }
    }
    return null;
  }

  Map<String, int> _seedDraftMap(
    List<SalesDocumentModel> documents,
    String? orderId, {
    required bool isInvoice,
  }) {
    if (orderId == null) {
      return const <String, int>{};
    }

    for (final SalesDocumentModel document in documents) {
      if (document.id != orderId) {
        continue;
      }

      final Map<String, int> seed = <String, int>{};
      for (final SalesDocumentLine line in document.items) {
        seed[line.id] = 0;
      }
      return seed;
    }

    return const <String, int>{};
  }

  int _sanitizeQty(int qty, int maxQty) {
    if (qty <= 0) {
      return 0;
    }
    if (qty > maxQty) {
      return maxQty;
    }
    return qty;
  }
}
