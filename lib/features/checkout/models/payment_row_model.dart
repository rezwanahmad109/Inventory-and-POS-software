import 'package:equatable/equatable.dart';

class PaymentRowModel extends Equatable {
  const PaymentRowModel({
    required this.id,
    required this.method,
    required this.amount,
  });

  final String id;
  final String method;
  final double amount;

  PaymentRowModel copyWith({String? method, double? amount}) {
    return PaymentRowModel(
      id: id,
      method: method ?? this.method,
      amount: amount ?? this.amount,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'method': method,
      'amount': amount,
    };
  }

  @override
  List<Object?> get props => [id, method, amount];
}
