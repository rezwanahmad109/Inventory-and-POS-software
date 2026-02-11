import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/utils/currency_formatter.dart';
import '../bloc/checkout_cubit.dart';
import '../bloc/checkout_state.dart';
import 'cart_item_tile.dart';

class CartSummaryWidget extends StatelessWidget {
  const CartSummaryWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CheckoutCubit, CheckoutState>(
      buildWhen: (prev, curr) => prev.cartItems != curr.cartItems,
      builder: (context, state) {
        final cubit = context.read<CheckoutCubit>();
        return Card(
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Cart Items', style: Theme.of(context).textTheme.titleMedium),
                    const Spacer(),
                    Text('${state.cartItems.length} items',
                        style: TextStyle(color: Colors.grey.shade600)),
                  ],
                ),
                const SizedBox(height: 8),
                if (state.cartItems.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text('No items in cart', style: TextStyle(color: Colors.grey)),
                    ),
                  )
                else ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                    child: Row(
                      children: [
                        Expanded(flex: 4, child: Text('Item', style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
                        SizedBox(width: 100, child: Text('Qty', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
                        SizedBox(width: 70, child: Text('Price', textAlign: TextAlign.right, style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
                        SizedBox(width: 80, child: Text('Total', textAlign: TextAlign.right, style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  ...state.cartItems.map((item) => CartItemTile(
                        item: item,
                        onQuantityChanged: (qty) =>
                            cubit.updateCartItemQuantity(item.productId, qty),
                        onRemove: () => cubit.removeCartItem(item.productId),
                      )),
                  const Divider(),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Subtotal', style: TextStyle(fontWeight: FontWeight.w600)),
                        Text(CurrencyFormatter.format(state.subtotal),
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
