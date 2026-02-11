import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/utils/currency_formatter.dart';
import '../bloc/checkout_cubit.dart';
import '../bloc/checkout_state.dart';

class SummaryFooterWidget extends StatelessWidget {
  const SummaryFooterWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CheckoutCubit, CheckoutState>(
      builder: (context, state) {
        final dueColor = state.dueAmount > 0
            ? const Color(0xFFD32F2F)
            : state.overpayment > 0
                ? const Color(0xFF1565C0)
                : const Color(0xFF388E3C);

        return Card(
          elevation: 3,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Summary', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                _SummaryRow(label: 'Subtotal', value: state.subtotal),
                if (state.discountValue > 0)
                  _SummaryRow(label: 'Discount', value: -state.discountValue, color: Colors.orange.shade700),
                if (state.taxValue > 0)
                  _SummaryRow(label: 'Tax', value: state.taxValue),
                const Divider(),
                _SummaryRow(label: 'Total Payable', value: state.totalPayable, bold: true, fontSize: 16),
                const SizedBox(height: 4),
                _SummaryRow(label: 'Total Paid', value: state.totalPaid, color: const Color(0xFF388E3C)),
                if (state.depositApplied > 0)
                  _SummaryRow(label: 'Deposit Applied', value: state.depositApplied, color: const Color(0xFF1565C0)),
                const Divider(),
                if (state.dueAmount > 0)
                  _SummaryRow(label: 'Due Amount', value: state.dueAmount, color: dueColor, bold: true, fontSize: 18),
                if (state.dueAmount == 0 && state.overpayment == 0)
                  _SummaryRow(label: 'Due Amount', value: 0, color: dueColor, bold: true, fontSize: 18),
                if (state.overpayment > 0) ...[
                  _SummaryRow(label: 'Change to return', value: state.overpayment, color: dueColor, bold: true, fontSize: 18),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.color,
    this.bold = false,
    this.fontSize = 14,
  });

  final String label;
  final double value;
  final Color? color;
  final bool bold;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(
            fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
            fontSize: fontSize,
            color: color,
          )),
          Text(
            CurrencyFormatter.format(value.abs()),
            style: TextStyle(
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              fontSize: fontSize,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
