import 'package:flutter/material.dart';
import '../../../core/utils/currency_formatter.dart';

class SuccessDialog extends StatelessWidget {
  const SuccessDialog({
    super.key,
    required this.saleId,
    required this.totalPayable,
    required this.totalPaid,
    required this.depositApplied,
    required this.dueAmount,
    required this.onNewSale,
  });

  final String saleId;
  final double totalPayable;
  final double totalPaid;
  final double depositApplied;
  final double dueAmount;
  final VoidCallback onNewSale;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Icon(Icons.check_circle, color: Colors.green.shade600, size: 32),
          const SizedBox(width: 8),
          const Text('Sale Complete!'),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Invoice: $saleId', style: TextStyle(color: Colors.grey.shade700)),
          const SizedBox(height: 12),
          _Row(label: 'Total', value: CurrencyFormatter.format(totalPayable)),
          _Row(label: 'Paid', value: CurrencyFormatter.format(totalPaid)),
          if (depositApplied > 0)
            _Row(label: 'Deposit Used', value: CurrencyFormatter.format(depositApplied)),
          if (dueAmount > 0)
            _Row(
              label: 'Due',
              value: CurrencyFormatter.format(dueAmount),
              valueColor: Colors.red.shade700,
            ),
          if (dueAmount == 0)
            _Row(
              label: 'Status',
              value: 'Fully Paid',
              valueColor: Colors.green.shade700,
            ),
        ],
      ),
      actions: [
        OutlinedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.print_outlined),
          label: const Text('Print Receipt'),
        ),
        FilledButton.icon(
          onPressed: onNewSale,
          icon: const Icon(Icons.add_shopping_cart),
          label: const Text('New Sale'),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: valueColor)),
        ],
      ),
    );
  }
}
