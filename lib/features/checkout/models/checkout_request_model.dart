import 'cart_item_model.dart';
import 'payment_row_model.dart';

class CheckoutRequestModel {
  const CheckoutRequestModel({
    this.customerId,
    required this.totalAmount,
    required this.discountAmount,
    required this.taxAmount,
    required this.netAmount,
    required this.paidAmount,
    required this.dueAmount,
    required this.depositUsed,
    this.notes,
    required this.saleItems,
    required this.payments,
  });

  final int? customerId;
  final double totalAmount;
  final double discountAmount;
  final double taxAmount;
  final double netAmount;
  final double paidAmount;
  final double dueAmount;
  final double depositUsed;
  final String? notes;
  final List<CartItemModel> saleItems;
  final List<PaymentRowModel> payments;

  Map<String, dynamic> toJson() {
    return {
      if (customerId != null) 'customerId': customerId,
      'totalAmount': totalAmount,
      'discountAmount': discountAmount,
      'taxAmount': taxAmount,
      'netAmount': netAmount,
      'paidAmount': paidAmount,
      'dueAmount': dueAmount,
      'depositUsed': depositUsed,
      if (notes != null && notes!.isNotEmpty) 'notes': notes,
      'saleItems': saleItems.map((e) => e.toJson()).toList(),
      'payments': payments.where((p) => p.amount > 0).map((e) => e.toJson()).toList(),
    };
  }
}
