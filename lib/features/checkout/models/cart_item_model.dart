import 'package:equatable/equatable.dart';

class CartItemModel extends Equatable {
  const CartItemModel({
    required this.productId,
    required this.name,
    required this.unitPrice,
    required this.quantity,
  });

  final int productId;
  final String name;
  final double unitPrice;
  final int quantity;

  double get lineTotal => unitPrice * quantity;

  CartItemModel copyWith({int? quantity}) {
    return CartItemModel(
      productId: productId,
      name: name,
      unitPrice: unitPrice,
      quantity: quantity ?? this.quantity,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'productId': productId,
      'quantity': quantity,
      'unitPrice': unitPrice,
      'totalPrice': lineTotal,
    };
  }

  @override
  List<Object?> get props => [productId, name, unitPrice, quantity];
}
