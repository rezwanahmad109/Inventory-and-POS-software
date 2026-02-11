import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/cart_item_model.dart';
import '../models/checkout_request_model.dart';
import '../models/customer_summary_model.dart';
import '../models/payment_row_model.dart';
import '../repository/checkout_repository.dart';
import 'checkout_state.dart';

class CheckoutCubit extends Cubit<CheckoutState> {
  CheckoutCubit({
    required this.repository,
    List<CartItemModel> initialCart = const [],
  }) : super(CheckoutState(
          cartItems: initialCart,
          paymentRows: [
            PaymentRowModel(id: _nextId(), method: 'cash', amount: 0),
          ],
        ));

  final CheckoutRepository repository;
  static int _idCounter = 0;
  static String _nextId() => 'pr_${++_idCounter}';

  Future<void> selectCustomer(CustomerSummaryModel? customer) async {
    if (customer == null) {
      emit(state.copyWith(clearCustomer: true));
      return;
    }
    emit(state.copyWith(
      selectedCustomer: customer,
      isLoadingCustomer: true,
      clearError: true,
    ));
    try {
      final details = await repository.getCustomerDetails(customer.id);
      emit(state.copyWith(customerDetails: details, isLoadingCustomer: false));
    } catch (e) {
      emit(state.copyWith(
        isLoadingCustomer: false,
        submissionError: 'Failed to load customer details',
      ));
    }
  }

  void updateCartItemQuantity(int productId, int newQty) {
    if (newQty <= 0) {
      removeCartItem(productId);
      return;
    }
    final items = state.cartItems.map((item) {
      if (item.productId == productId) return item.copyWith(quantity: newQty);
      return item;
    }).toList();
    emit(state.copyWith(cartItems: items));
  }

  void removeCartItem(int productId) {
    final items = state.cartItems.where((i) => i.productId != productId).toList();
    emit(state.copyWith(cartItems: items));
  }

  void addPaymentRow() {
    final rows = [
      ...state.paymentRows,
      PaymentRowModel(id: _nextId(), method: 'cash', amount: 0),
    ];
    emit(state.copyWith(paymentRows: rows));
  }

  void removePaymentRow(String rowId) {
    if (state.paymentRows.length <= 1) return;
    final rows = state.paymentRows.where((r) => r.id != rowId).toList();
    emit(state.copyWith(paymentRows: rows));
  }

  void updatePaymentRow(String rowId, {String? method, double? amount}) {
    final rows = state.paymentRows.map((row) {
      if (row.id == rowId) return row.copyWith(method: method, amount: amount);
      return row;
    }).toList();
    emit(state.copyWith(paymentRows: rows));
  }

  void toggleDeposit(bool value) {
    emit(state.copyWith(useDeposit: value, depositAmount: 0));
  }

  void updateDepositAmount(double amount) {
    emit(state.copyWith(depositAmount: amount));
  }

  void updateDiscount(double amount, {bool? isPercentage}) {
    emit(state.copyWith(
      discountAmount: amount,
      discountIsPercentage: isPercentage,
    ));
  }

  void updateTaxPercentage(double tax) {
    emit(state.copyWith(taxPercentage: tax));
  }

  Future<void> submit() async {
    if (state.isSubmitting) return;
    emit(state.copyWith(isSubmitting: true, clearError: true));

    try {
      final request = CheckoutRequestModel(
        customerId: state.selectedCustomer?.id,
        totalAmount: state.subtotal,
        discountAmount: state.discountValue,
        taxAmount: state.taxValue,
        netAmount: state.totalPayable,
        paidAmount: state.totalPaid,
        dueAmount: state.dueAmount,
        depositUsed: state.depositApplied,
        saleItems: state.cartItems,
        payments: state.paymentRows,
      );

      final result = await repository.submitSale(request);
      final saleId = result['id']?.toString() ?? '';

      if (state.depositApplied > 0 && state.selectedCustomer != null) {
        await repository.recordDepositUsage(
          customerId: state.selectedCustomer!.id,
          amount: state.depositApplied,
          saleId: saleId,
        );
      }

      emit(state.copyWith(
        isSubmitting: false,
        submissionSuccess: true,
        saleId: saleId,
      ));
    } catch (e) {
      emit(state.copyWith(
        isSubmitting: false,
        submissionError: e.toString(),
      ));
    }
  }

  void reset(List<CartItemModel> newCart) {
    _idCounter = 0;
    emit(CheckoutState(
      cartItems: newCart,
      paymentRows: [
        PaymentRowModel(id: _nextId(), method: 'cash', amount: 0),
      ],
    ));
  }
}
