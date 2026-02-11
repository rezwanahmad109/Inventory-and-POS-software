import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/utils/currency_formatter.dart';
import '../bloc/checkout_cubit.dart';
import '../bloc/checkout_state.dart';
import 'payment_row_widget.dart';

class PaymentMethodsWidget extends StatelessWidget {
  const PaymentMethodsWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CheckoutCubit, CheckoutState>(
      buildWhen: (prev, curr) => prev.paymentRows != curr.paymentRows,
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
                    Text('Payment Methods', style: Theme.of(context).textTheme.titleMedium),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline, color: Color(0xFFFFB300)),
                      tooltip: 'Add Payment Method',
                      onPressed: () => cubit.addPaymentRow(),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                ...state.paymentRows.map((row) => PaymentRowWidget(
                      row: row,
                      canRemove: state.paymentRows.length > 1,
                      onMethodChanged: (m) => cubit.updatePaymentRow(row.id, method: m),
                      onAmountChanged: (a) => cubit.updatePaymentRow(row.id, amount: a),
                      onRemove: () => cubit.removePaymentRow(row.id),
                    )),
                const Divider(),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Paid', style: TextStyle(fontWeight: FontWeight.w600)),
                    Text(CurrencyFormatter.format(state.totalPaid),
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
