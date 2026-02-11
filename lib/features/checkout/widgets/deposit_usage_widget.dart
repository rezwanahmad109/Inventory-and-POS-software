import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/utils/currency_formatter.dart';
import '../bloc/checkout_cubit.dart';
import '../bloc/checkout_state.dart';

class DepositUsageWidget extends StatelessWidget {
  const DepositUsageWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CheckoutCubit, CheckoutState>(
      builder: (context, state) {
        final hasCustomer = state.customerDetails != null;
        final hasDeposit = hasCustomer && state.customerDetails!.totalDeposit >= 1;

        if (state.isWalkIn || !hasDeposit) {
          return const SizedBox.shrink();
        }

        final cubit = context.read<CheckoutCubit>();
        final available = state.customerDetails!.totalDeposit;

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
                    Checkbox(
                      value: state.useDeposit,
                      onChanged: (v) => cubit.toggleDeposit(v ?? false),
                    ),
                    Expanded(
                      child: Text(
                        'Use Customer Deposit (Available: ${CurrencyFormatter.format(available)})',
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
                if (state.useDeposit) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Text('Deposit to apply: '),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            hintText: CurrencyFormatter.formatPlain(state.depositApplied),
                            prefixText: '\$ ',
                          ),
                          onChanged: (v) {
                            final val = double.tryParse(v) ?? 0;
                            final capped = val > available ? available : val;
                            cubit.updateDepositAmount(capped);
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Applied: ${CurrencyFormatter.format(state.depositApplied)}',
                    style: const TextStyle(color: Color(0xFF388E3C), fontWeight: FontWeight.w600),
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
