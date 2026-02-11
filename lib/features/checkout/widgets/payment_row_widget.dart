import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/payment_row_model.dart';

class PaymentRowWidget extends StatelessWidget {
  const PaymentRowWidget({
    super.key,
    required this.row,
    required this.canRemove,
    required this.onMethodChanged,
    required this.onAmountChanged,
    required this.onRemove,
  });

  final PaymentRowModel row;
  final bool canRemove;
  final ValueChanged<String> onMethodChanged;
  final ValueChanged<double> onAmountChanged;
  final VoidCallback onRemove;

  static const List<String> methods = ['cash', 'card', 'mobile', 'bank_transfer', 'check'];
  static const Map<String, String> methodLabels = {
    'cash': 'Cash',
    'card': 'Card',
    'mobile': 'Mobile/Digital',
    'bank_transfer': 'Bank Transfer',
    'check': 'Check',
  };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            flex: 4,
            child: DropdownButtonFormField<String>(
              value: methods.contains(row.method) ? row.method : 'cash',
              isDense: true,
              decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
              items: methods
                  .map((m) => DropdownMenuItem(value: m, child: Text(methodLabels[m] ?? m, style: const TextStyle(fontSize: 13))))
                  .toList(),
              onChanged: (v) {
                if (v != null) onMethodChanged(v);
              },
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 3,
            child: TextField(
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
              decoration: const InputDecoration(
                isDense: true,
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                hintText: '0.00',
                prefixText: '\$ ',
              ),
              onChanged: (v) => onAmountChanged(double.tryParse(v) ?? 0),
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            icon: Icon(Icons.delete_outline, color: canRemove ? Colors.red.shade400 : Colors.grey.shade300),
            iconSize: 20,
            onPressed: canRemove ? onRemove : null,
            tooltip: 'Remove',
          ),
        ],
      ),
    );
  }
}
