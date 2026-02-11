import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/checkout_cubit.dart';
import '../bloc/checkout_state.dart';

class DiscountTaxWidget extends StatelessWidget {
  const DiscountTaxWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CheckoutCubit, CheckoutState>(
      buildWhen: (prev, curr) =>
          prev.discountAmount != curr.discountAmount ||
          prev.discountIsPercentage != curr.discountIsPercentage ||
          prev.taxPercentage != curr.taxPercentage,
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
                Text('Discount & Tax', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
                        decoration: InputDecoration(
                          labelText: 'Discount',
                          suffixText: state.discountIsPercentage ? '%' : '\$',
                          isDense: true,
                        ),
                        onChanged: (v) => cubit.updateDiscount(double.tryParse(v) ?? 0),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('%'),
                      selected: state.discountIsPercentage,
                      onSelected: (_) => cubit.updateDiscount(state.discountAmount, isPercentage: true),
                    ),
                    const SizedBox(width: 4),
                    ChoiceChip(
                      label: const Text('\$'),
                      selected: !state.discountIsPercentage,
                      onSelected: (_) => cubit.updateDiscount(state.discountAmount, isPercentage: false),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
                  decoration: const InputDecoration(
                    labelText: 'Tax %',
                    suffixText: '%',
                    isDense: true,
                  ),
                  onChanged: (v) => cubit.updateTaxPercentage(double.tryParse(v) ?? 0),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
