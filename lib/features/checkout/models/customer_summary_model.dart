import 'package:equatable/equatable.dart';

class CustomerSummaryModel extends Equatable {
  const CustomerSummaryModel({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.totalDue = 0,
    this.totalDeposit = 0,
  });

  final int id;
  final String name;
  final String phone;
  final String? email;
  final double totalDue;
  final double totalDeposit;

  factory CustomerSummaryModel.fromJson(Map<String, dynamic> json) {
    return CustomerSummaryModel(
      id: json['id'] as int,
      name: json['name'] as String,
      phone: json['phone'] as String,
      email: json['email'] as String?,
      totalDue: (json['totalDue'] is num)
          ? (json['totalDue'] as num).toDouble()
          : double.tryParse(json['totalDue']?.toString() ?? '0') ?? 0,
      totalDeposit: (json['totalDeposit'] is num)
          ? (json['totalDeposit'] as num).toDouble()
          : double.tryParse(json['totalDeposit']?.toString() ?? '0') ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, name, phone, email, totalDue, totalDeposit];
}
