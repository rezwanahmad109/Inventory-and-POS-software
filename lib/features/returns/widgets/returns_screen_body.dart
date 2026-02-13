import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/returns_cubit.dart';
import '../bloc/returns_state.dart';
import '../repository/returns_repository.dart';

class ReturnsScreenBody extends StatelessWidget {
  const ReturnsScreenBody({required this.module, super.key});

  final ReturnModuleType module;

  String get _title =>
      module == ReturnModuleType.sales ? 'Sales Return' : 'Purchase Return';

  String get _invoiceLabel =>
      module == ReturnModuleType.sales ? 'Sale Invoice' : 'Purchase Invoice';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: BlocConsumer<ReturnsCubit, ReturnsState>(
        listener: (BuildContext context, ReturnsState state) async {
          if (state.successMessage != null &&
              state.successMessage!.isNotEmpty) {
            await _showDialog(
              context,
              title: 'Success',
              message: state.successMessage!,
              icon: Icons.check_circle_outline,
              color: Colors.green.shade700,
            );
            if (context.mounted) {
              context.read<ReturnsCubit>().clearFeedback();
            }
          } else if (state.errorMessage != null &&
              state.errorMessage!.isNotEmpty &&
              !state.isLoading) {
            await _showDialog(
              context,
              title: 'Request Failed',
              message: _cleanError(state.errorMessage!),
              icon: Icons.error_outline,
              color: Colors.red.shade700,
            );
            if (context.mounted) {
              context.read<ReturnsCubit>().clearFeedback();
            }
          }
        },
        builder: (BuildContext context, ReturnsState state) {
          if (state.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (state.invoices.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    const Icon(Icons.receipt_long_outlined, size: 42),
                    const SizedBox(height: 10),
                    Text('No invoices available for $_title.'),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () =>
                          context.read<ReturnsCubit>().loadInvoices(),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Reload'),
                    ),
                  ],
                ),
              ),
            );
          }

          return LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final bool isWide = constraints.maxWidth >= 960;
              final Widget invoicePanel = _InvoicePanel(
                invoiceLabel: _invoiceLabel,
                state: state,
              );
              final Widget productPanel = _ProductSelectionPanel(
                state: state,
                isSubmitting: state.isSubmitting,
                onSubmit: () => context.read<ReturnsCubit>().submit(),
                onNoteChanged: (String value) =>
                    context.read<ReturnsCubit>().updateNote(value),
              );

              if (isWide) {
                return Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Expanded(flex: 4, child: invoicePanel),
                      const SizedBox(width: 12),
                      Expanded(flex: 6, child: productPanel),
                    ],
                  ),
                );
              }

              return ListView(
                padding: const EdgeInsets.all(16),
                children: <Widget>[
                  invoicePanel,
                  const SizedBox(height: 12),
                  productPanel,
                ],
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _showDialog(
    BuildContext context, {
    required String title,
    required String message,
    required IconData icon,
    required Color color,
  }) {
    return showDialog<void>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Row(
          children: <Widget>[
            Icon(icon, color: color),
            const SizedBox(width: 8),
            Text(title),
          ],
        ),
        content: Text(message),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  String _cleanError(String raw) {
    const String prefix = 'Exception:';
    return raw.startsWith(prefix) ? raw.substring(prefix.length).trim() : raw;
  }
}

class _InvoicePanel extends StatelessWidget {
  const _InvoicePanel({required this.invoiceLabel, required this.state});

  final String invoiceLabel;
  final ReturnsState state;

  @override
  Widget build(BuildContext context) {
    final ReturnInvoice? selectedInvoice = state.selectedInvoice;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'Select Invoice',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              value: selectedInvoice?.id,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: invoiceLabel,
                prefixIcon: const Icon(Icons.receipt_long_outlined),
              ),
              items: state.invoices
                  .map(
                    (ReturnInvoice invoice) => DropdownMenuItem<String>(
                      value: invoice.id,
                      child: Text(invoice.invoiceNumber),
                    ),
                  )
                  .toList(growable: false),
              onChanged: (String? value) {
                if (value == null) return;
                context.read<ReturnsCubit>().selectInvoice(value);
              },
            ),
            const SizedBox(height: 14),
            if (selectedInvoice != null) _InvoiceMeta(invoice: selectedInvoice),
          ],
        ),
      ),
    );
  }
}

class _InvoiceMeta extends StatelessWidget {
  const _InvoiceMeta({required this.invoice});

  final ReturnInvoice invoice;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: Theme.of(context).colorScheme.primary.withOpacity(0.06),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            invoice.invoiceNumber,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text('Products: ${invoice.items.length}'),
          if (invoice.createdAt != null)
            Text('Date: ${_simpleDate(invoice.createdAt!)}'),
        ],
      ),
    );
  }

  static String _simpleDate(DateTime dateTime) {
    final DateTime local = dateTime.toLocal();
    final String month = local.month.toString().padLeft(2, '0');
    final String day = local.day.toString().padLeft(2, '0');
    return '${local.year}-$month-$day';
  }
}

class _ProductSelectionPanel extends StatelessWidget {
  const _ProductSelectionPanel({
    required this.state,
    required this.isSubmitting,
    required this.onSubmit,
    required this.onNoteChanged,
  });

  final ReturnsState state;
  final bool isSubmitting;
  final VoidCallback onSubmit;
  final ValueChanged<String> onNoteChanged;

  @override
  Widget build(BuildContext context) {
    final ReturnInvoice? selectedInvoice = state.selectedInvoice;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'Return Items',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 10),
            if (selectedInvoice == null)
              const Text('Select an invoice to load products.')
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: selectedInvoice.items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (BuildContext context, int index) {
                  final ReturnInvoiceItem item = selectedInvoice.items[index];
                  final int selectedQty = state.selectedCountFor(
                    item.productId,
                  );
                  return _ReturnItemRow(
                    item: item,
                    selectedQty: selectedQty,
                    onIncrement: () => context
                        .read<ReturnsCubit>()
                        .incrementQty(item.productId),
                    onDecrement: () => context
                        .read<ReturnsCubit>()
                        .decrementQty(item.productId),
                  );
                },
              ),
            const SizedBox(height: 14),
            TextFormField(
              key: ValueKey<String>(
                'return-note-${state.selectedInvoice?.id ?? 'none'}-${state.successMessage ?? ''}',
              ),
              initialValue: state.note,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Return Note (optional)',
                hintText: 'Add reason or reference note',
                prefixIcon: Icon(Icons.notes_outlined),
              ),
              onChanged: onNoteChanged,
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed:
                    isSubmitting ||
                        selectedInvoice == null ||
                        !state.hasSelectedProducts
                    ? null
                    : onSubmit,
                icon: isSubmitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.assignment_return_outlined),
                label: Text(isSubmitting ? 'Submitting...' : 'Submit Return'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReturnItemRow extends StatelessWidget {
  const _ReturnItemRow({
    required this.item,
    required this.selectedQty,
    required this.onIncrement,
    required this.onDecrement,
  });

  final ReturnInvoiceItem item;
  final int selectedQty;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  @override
  Widget build(BuildContext context) {
    final bool canIncrement = selectedQty < item.originalQuantity;
    final bool canDecrement = selectedQty > 0;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFE0E0E0)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  item.productName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  'Original: ${item.originalQuantity} | Price: \$${item.unitPrice.toStringAsFixed(2)}',
                  style: const TextStyle(color: Colors.black54, fontSize: 12.5),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: canDecrement ? onDecrement : null,
            icon: const Icon(Icons.remove_circle_outline),
          ),
          Container(
            constraints: const BoxConstraints(minWidth: 34),
            alignment: Alignment.center,
            child: Text(
              '$selectedQty',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          IconButton(
            onPressed: canIncrement ? onIncrement : null,
            icon: const Icon(Icons.add_circle_outline),
          ),
        ],
      ),
    );
  }
}
