import 'package:equatable/equatable.dart';
import '../models/cart_item_model.dart';
import '../models/customer_summary_model.dart';
import '../models/payment_row_model.dart';

class CheckoutState extends Equatable {
  const CheckoutState({
    this.selectedCustomer,
    this.customerDetails,
    this.isLoadingCustomer = false,
    this.cartItems = const [],
    this.paymentRows = const [],
    this.useDeposit = false,
    this.depositAmount = 0,
    this.discountAmount = 0,
    this.discountIsPercentage = false,
    this.taxPercentage = 0,
    this.isSubmitting = false,
    this.submissionError,
    this.submissionSuccess = false,
    this.saleId,
  });

  final CustomerSummaryModel? selectedCustomer;
  final CustomerSummaryModel? customerDetails;
  final bool isLoadingCustomer;
  final List<CartItemModel> cartItems;
  final List<PaymentRowModel> paymentRows;
  final bool useDeposit;
  final double depositAmount;
  final double discountAmount;
  final bool discountIsPercentage;
  final double taxPercentage;
  final bool isSubmitting;
  final String? submissionError;
  final bool submissionSuccess;
  final String? saleId;

  double get subtotal =>
      cartItems.fold(0.0, (sum, item) => sum + item.lineTotal);

  double get discountValue => discountIsPercentage
      ? subtotal * (discountAmount / 100)
      : discountAmount;

  double get taxValue => (subtotal - discountValue) * (taxPercentage / 100);

  double get totalPayable => subtotal - discountValue + taxValue;

  double get totalPaid =>
      paymentRows.fold(0.0, (sum, row) => sum + row.amount);

  double get depositApplied {
    if (!useDeposit || customerDetails == null) return 0;
    final available = customerDetails!.totalDeposit;
    final remaining = totalPayable - totalPaid;
    if (remaining <= 0) return 0;
    final auto = remaining < available ? remaining : available;
    return depositAmount > 0 && depositAmount <= auto ? depositAmount : auto;
  }

  double get dueAmount {
    final due = totalPayable - totalPaid - depositApplied;
    return due > 0 ? due : 0;
  }

  double get overpayment {
    final over = totalPaid + depositApplied - totalPayable;
    return over > 0 ? over : 0;
  }

  bool get isWalkIn => selectedCustomer == null;

  CheckoutState copyWith({
    CustomerSummaryModel? selectedCustomer,
    CustomerSummaryModel? customerDetails,
    bool? isLoadingCustomer,
    List<CartItemModel>? cartItems,
    List<PaymentRowModel>? paymentRows,
    bool? useDeposit,
    double? depositAmount,
    double? discountAmount,
    bool? discountIsPercentage,
    double? taxPercentage,
    bool? isSubmitting,
    String? submissionError,
    bool? submissionSuccess,
    String? saleId,
    bool clearCustomer = false,
    bool clearError = false,
  }) {
    return CheckoutState(
      selectedCustomer: clearCustomer ? null : (selectedCustomer ?? this.selectedCustomer),
      customerDetails: clearCustomer ? null : (customerDetails ?? this.customerDetails),
      isLoadingCustomer: isLoadingCustomer ?? this.isLoadingCustomer,
      cartItems: cartItems ?? this.cartItems,
      paymentRows: paymentRows ?? this.paymentRows,
      useDeposit: clearCustomer ? false : (useDeposit ?? this.useDeposit),
      depositAmount: clearCustomer ? 0 : (depositAmount ?? this.depositAmount),
      discountAmount: discountAmount ?? this.discountAmount,
      discountIsPercentage: discountIsPercentage ?? this.discountIsPercentage,
      taxPercentage: taxPercentage ?? this.taxPercentage,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      submissionError: clearError ? null : (submissionError ?? this.submissionError),
      submissionSuccess: submissionSuccess ?? this.submissionSuccess,
      saleId: saleId ?? this.saleId,
    );
  }

  @override
  List<Object?> get props => [
        selectedCustomer,
        customerDetails,
        isLoadingCustomer,
        cartItems,
        paymentRows,
        useDeposit,
        depositAmount,
        discountAmount,
        discountIsPercentage,
        taxPercentage,
        isSubmitting,
        submissionError,
        submissionSuccess,
        saleId,
      ];
}
