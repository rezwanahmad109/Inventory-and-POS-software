import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/api/api_client.dart';
import '../../core/utils/currency_formatter.dart';
import 'bloc/checkout_cubit.dart';
import 'bloc/checkout_state.dart';
import 'models/cart_item_model.dart';
import 'models/customer_summary_model.dart';
import 'repository/checkout_repository.dart';
import 'widgets/cart_item_tile.dart';
import 'widgets/cart_summary_widget.dart';
import 'widgets/customer_selector_widget.dart';
import 'widgets/deposit_usage_widget.dart';
import 'widgets/discount_tax_widget.dart';
import 'widgets/payment_methods_widget.dart';
import 'widgets/success_dialog.dart';
import 'widgets/summary_footer_widget.dart';

class NewCheckoutScreen extends StatelessWidget {
  const NewCheckoutScreen({super.key, this.initialCart = const []});

  final List<CartItemModel> initialCart;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => CheckoutCubit(
        repository: CheckoutRepository(apiClient: ApiClient()),
        initialCart: initialCart,
      ),
      child: const _CheckoutView(),
    );
  }
}

class _CheckoutView extends StatelessWidget {
  const _CheckoutView();

  @override
  Widget build(BuildContext context) {
    return BlocListener<CheckoutCubit, CheckoutState>(
      listenWhen: (prev, curr) =>
          prev.submissionSuccess != curr.submissionSuccess ||
          prev.submissionError != curr.submissionError,
      listener: (context, state) {
        if (state.submissionSuccess) {
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (_) => SuccessDialog(
              saleId: state.saleId ?? '',
              totalPayable: state.totalPayable,
              totalPaid: state.totalPaid,
              depositApplied: state.depositApplied,
              dueAmount: state.dueAmount,
              onNewSale: () {
                Navigator.of(context).pop();
                context.read<CheckoutCubit>().reset([]);
              },
            ),
          );
        }
        if (state.submissionError != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.submissionError!),
              backgroundColor: Colors.red.shade700,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Checkout'),
          centerTitle: false,
        ),
        body: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 900;
            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 6,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: const [
                          CustomerSelectorWidget(),
                          SizedBox(height: 12),
                          CartSummaryWidget(),
                        ],
                      ),
                    ),
                  ),
                  const VerticalDivider(width: 1),
                  Expanded(
                    flex: 4,
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: const [
                          DiscountTaxWidget(),
                          SizedBox(height: 12),
                          PaymentMethodsWidget(),
                          SizedBox(height: 12),
                          DepositUsageWidget(),
                          SizedBox(height: 12),
                          SummaryFooterWidget(),
                          SizedBox(height: 12),
                          _SubmitButton(),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            }
            return SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: const [
                  CustomerSelectorWidget(),
                  SizedBox(height: 12),
                  CartSummaryWidget(),
                  SizedBox(height: 12),
                  DiscountTaxWidget(),
                  SizedBox(height: 12),
                  PaymentMethodsWidget(),
                  SizedBox(height: 12),
                  DepositUsageWidget(),
                  SizedBox(height: 12),
                  SummaryFooterWidget(),
                  SizedBox(height: 12),
                  _SubmitButton(),
                  SizedBox(height: 24),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CheckoutCubit, CheckoutState>(
      builder: (context, state) {
        final canSubmit = state.cartItems.isNotEmpty && !state.isSubmitting;
        return SizedBox(
          width: double.infinity,
          height: 52,
          child: FilledButton.icon(
            onPressed: canSubmit
                ? () => _handleSubmit(context, state)
                : null,
            icon: state.isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check_circle_outline),
            label: Text(state.isSubmitting ? 'Processing...' : 'Complete Sale'),
          ),
        );
      },
    );
  }

  void _handleSubmit(BuildContext context, CheckoutState state) {
    if (state.dueAmount > 0 && state.isWalkIn) {
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Cannot Create Due'),
          content: const Text(
            'Walk-in customers cannot have credit. Please collect full payment.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    if (state.dueAmount > 0 && !state.isWalkIn) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Confirm Due'),
          content: Text(
            'This will add ${CurrencyFormatter.format(state.dueAmount)} '
            'to the customer\'s outstanding balance. Proceed?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(ctx);
                context.read<CheckoutCubit>().submit();
              },
              child: const Text('Confirm'),
            ),
          ],
        ),
      );
      return;
    }

    context.read<CheckoutCubit>().submit();
  }
}
