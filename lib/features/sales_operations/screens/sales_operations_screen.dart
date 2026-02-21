import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/api/api_client.dart';
import '../../../core/ui/feedback_panel.dart';
import '../../../core/ui/offline_status_banner.dart';
import '../bloc/sales_operations_cubit.dart';
import '../bloc/sales_operations_state.dart';
import '../repository/sales_operations_repository.dart';

class SalesOperationsScreen extends StatelessWidget {
  const SalesOperationsScreen({required this.apiClient, super.key});

  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SalesOperationsCubit>(
      create: (_) => SalesOperationsCubit(
        repository: SalesOperationsRepository(apiClient: apiClient),
      )..loadAll(),
      child: _SalesOperationsView(apiClient: apiClient),
    );
  }
}

class _SalesOperationsView extends StatelessWidget {
  const _SalesOperationsView({required this.apiClient});

  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: BlocConsumer<SalesOperationsCubit, SalesOperationsState>(
        listener: (BuildContext context, SalesOperationsState state) {
          if (state.errorMessage != null && state.errorMessage!.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(_cleanError(state.errorMessage!))),
            );
            context.read<SalesOperationsCubit>().clearFeedback();
          }
          if (state.successMessage != null &&
              state.successMessage!.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.successMessage!),
                backgroundColor: Colors.green.shade700,
              ),
            );
            context.read<SalesOperationsCubit>().clearFeedback();
          }
        },
        builder: (BuildContext context, SalesOperationsState state) {
          return Scaffold(
            appBar: AppBar(
              title: const Text('Sales Order, Delivery, Invoice & AR'),
              bottom: const TabBar(
                tabs: <Tab>[
                  Tab(text: 'Orders'),
                  Tab(text: 'Fulfillment'),
                  Tab(text: 'AR Ledger'),
                ],
              ),
              actions: <Widget>[
                IconButton(
                  onPressed: state.isLoading
                      ? null
                      : () => context.read<SalesOperationsCubit>().loadAll(),
                  tooltip: 'Reload',
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            body: OfflineStatusBanner(
              apiClient: apiClient,
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : const TabBarView(
                      children: <Widget>[
                        _OrdersTab(),
                        _FulfillmentTab(),
                        _ArLedgerTab(),
                      ],
                    ),
            ),
          );
        },
      ),
    );
  }

  String _cleanError(String raw) {
    const String prefix = 'Exception:';
    return raw.startsWith(prefix) ? raw.substring(prefix.length).trim() : raw;
  }
}

class _OrdersTab extends StatelessWidget {
  const _OrdersTab();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SalesOperationsCubit, SalesOperationsState>(
      builder: (BuildContext context, SalesOperationsState state) {
        return LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final bool wide = constraints.maxWidth >= 1100;

            final Widget createCard = const _CreateSalesOrderCard();
            final Widget listCard = _SalesDocumentsCard(
              quotations: state.quotations,
              invoices: state.invoices,
            );

            if (!wide) {
              return ListView(
                padding: const EdgeInsets.all(12),
                children: <Widget>[
                  createCard,
                  const SizedBox(height: 12),
                  listCard,
                ],
              );
            }

            return Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Expanded(flex: 5, child: createCard),
                  const SizedBox(width: 12),
                  Expanded(flex: 7, child: listCard),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _CreateSalesOrderCard extends StatefulWidget {
  const _CreateSalesOrderCard();

  @override
  State<_CreateSalesOrderCard> createState() => _CreateSalesOrderCardState();
}

class _CreateSalesOrderCardState extends State<_CreateSalesOrderCard> {
  final TextEditingController _noteController = TextEditingController();
  final TextEditingController _qtyController = TextEditingController(text: '1');
  final TextEditingController _priceController = TextEditingController();
  final List<_DraftOrderLine> _draftLines = <_DraftOrderLine>[];

  int? _selectedCustomerId;
  String? _selectedProductId;

  @override
  void dispose() {
    _noteController.dispose();
    _qtyController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SalesOperationsCubit, SalesOperationsState>(
      builder: (BuildContext context, SalesOperationsState state) {
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Create Sales Order',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<int>(
                  value: _selectedCustomerId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Customer (optional)',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  items: <DropdownMenuItem<int>>[
                    const DropdownMenuItem<int>(
                      value: null,
                      child: Text('Walk-in / Unassigned'),
                    ),
                    ...state.customers.map(
                      (CustomerLookup customer) => DropdownMenuItem<int>(
                        value: customer.id,
                        child: Text(customer.name),
                      ),
                    ),
                  ],
                  onChanged: (int? value) {
                    setState(() {
                      _selectedCustomerId = value;
                    });
                  },
                ),
                const SizedBox(height: 10),
                Row(
                  children: <Widget>[
                    Expanded(
                      flex: 5,
                      child: DropdownButtonFormField<String>(
                        value: _selectedProductId,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Product',
                          prefixIcon: Icon(Icons.inventory_2_outlined),
                        ),
                        items: state.products
                            .map(
                              (ProductLookup product) =>
                                  DropdownMenuItem<String>(
                                    value: product.id,
                                    child: Text(
                                      '${product.name} (${product.sku})',
                                    ),
                                  ),
                            )
                            .toList(growable: false),
                        onChanged: (String? value) {
                          setState(() {
                            _selectedProductId = value;
                          });
                          final ProductLookup? selected = _findProduct(
                            state.products,
                            value,
                          );
                          if (selected != null) {
                            _priceController.text = selected.price
                                .toStringAsFixed(2);
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: _qtyController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Qty'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: TextField(
                        controller: _priceController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(labelText: 'Price'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filledTonal(
                      tooltip: 'Add line',
                      onPressed: () => _addLine(state.products),
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (_draftLines.isEmpty)
                  const FeedbackPanel(
                    message:
                        'Add one or more lines to create a sales order quotation.',
                  ),
                if (_draftLines.isNotEmpty)
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _draftLines.length,
                    separatorBuilder: (_, __) => const Divider(height: 8),
                    itemBuilder: (BuildContext context, int index) {
                      final _DraftOrderLine row = _draftLines[index];
                      return ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text(row.productName),
                        subtitle: Text(
                          'Qty ${row.quantity} x \$${row.unitPrice.toStringAsFixed(2)}',
                        ),
                        trailing: IconButton(
                          onPressed: () {
                            setState(() {
                              _draftLines.removeAt(index);
                            });
                          },
                          icon: const Icon(Icons.delete_outline),
                        ),
                      );
                    },
                  ),
                const SizedBox(height: 10),
                TextField(
                  controller: _noteController,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Order note',
                    hintText: 'Optional internal note',
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: state.isSubmitting
                        ? null
                        : () async {
                            await context
                                .read<SalesOperationsCubit>()
                                .createSalesOrder(
                                  customerId: _selectedCustomerId,
                                  lines: _draftLines
                                      .map(
                                        (_DraftOrderLine row) =>
                                            CreateSalesOrderLineInput(
                                              productId: row.productId,
                                              quantity: row.quantity,
                                              unitPrice: row.unitPrice,
                                              warehouseId: row.warehouseId,
                                            ),
                                      )
                                      .toList(growable: false),
                                  notes: _noteController.text,
                                );
                            if (!mounted) return;
                            setState(() {
                              _draftLines.clear();
                              _noteController.clear();
                              _selectedProductId = null;
                              _qtyController.text = '1';
                              _priceController.clear();
                            });
                          },
                    icon: state.isSubmitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.save_outlined),
                    label: Text(
                      state.isSubmitting ? 'Saving...' : 'Create Sales Order',
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _addLine(List<ProductLookup> products) {
    final ProductLookup? product = _findProduct(products, _selectedProductId);
    final int qty = int.tryParse(_qtyController.text.trim()) ?? 0;
    final double price = double.tryParse(_priceController.text.trim()) ?? 0;
    if (product == null || qty <= 0 || price <= 0) {
      return;
    }

    setState(() {
      _draftLines.add(
        _DraftOrderLine(
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPrice: price,
          warehouseId: product.defaultWarehouseId,
        ),
      );
    });
  }

  ProductLookup? _findProduct(List<ProductLookup> products, String? productId) {
    if (productId == null) return null;
    for (final ProductLookup product in products) {
      if (product.id == productId) {
        return product;
      }
    }
    return null;
  }
}

class _SalesDocumentsCard extends StatelessWidget {
  const _SalesDocumentsCard({required this.quotations, required this.invoices});

  final List<SalesDocumentModel> quotations;
  final List<SalesDocumentModel> invoices;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'Recent Orders & Invoices',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 10),
            if (quotations.isEmpty && invoices.isEmpty)
              const FeedbackPanel(message: 'No sales documents available yet.'),
            if (quotations.isNotEmpty) ...<Widget>[
              Text(
                'Sales Orders (Quotations)',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 6),
              _DocumentList(documents: quotations),
              const SizedBox(height: 10),
            ],
            if (invoices.isNotEmpty) ...<Widget>[
              Text('Invoices', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 6),
              _DocumentList(documents: invoices),
            ],
          ],
        ),
      ),
    );
  }
}

class _DocumentList extends StatelessWidget {
  const _DocumentList({required this.documents});

  final List<SalesDocumentModel> documents;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: documents.length,
      separatorBuilder: (_, __) => const Divider(height: 8),
      itemBuilder: (BuildContext context, int index) {
        final SalesDocumentModel document = documents[index];
        return ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          title: Text(document.invoiceNumber),
          subtitle: Text(
            '${document.customerName} | ${document.status.toUpperCase()} | ${_dateLabel(document.createdAt)}',
          ),
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Text('Due \$${document.dueTotal.toStringAsFixed(2)}'),
              Text('Paid \$${document.paidTotal.toStringAsFixed(2)}'),
            ],
          ),
        );
      },
    );
  }
}

class _FulfillmentTab extends StatefulWidget {
  const _FulfillmentTab();

  @override
  State<_FulfillmentTab> createState() => _FulfillmentTabState();
}

class _FulfillmentTabState extends State<_FulfillmentTab> {
  final TextEditingController _noteController = TextEditingController();

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SalesOperationsCubit, SalesOperationsState>(
      builder: (BuildContext context, SalesOperationsState state) {
        final SalesDocumentModel? order = state.selectedOrder;
        return ListView(
          padding: const EdgeInsets.all(12),
          children: <Widget>[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Partial Delivery & Invoice',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: state.selectedOrderId,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Sales Order',
                        prefixIcon: Icon(Icons.receipt_long_outlined),
                      ),
                      items: state.quotations
                          .map(
                            (
                              SalesDocumentModel doc,
                            ) => DropdownMenuItem<String>(
                              value: doc.id,
                              child: Text(
                                '${doc.invoiceNumber} - ${doc.customerName}',
                              ),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) {
                        context.read<SalesOperationsCubit>().selectOrder(value);
                      },
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _noteController,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Note',
                        hintText:
                            'Optional memo for delivery/invoice conversion',
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (order == null)
                      const FeedbackPanel(
                        message:
                            'Select a sales order to post delivery/invoice.',
                      )
                    else ...<Widget>[
                      ...order.items.map(
                        (SalesDocumentLine line) => _LineFulfillmentRow(
                          line: line,
                          deliveryValue:
                              state.deliveryDraftByLineId[line.id] ?? 0,
                          invoiceValue:
                              state.invoiceDraftByLineId[line.id] ?? 0,
                          onDeliveryChanged: (int value) => context
                              .read<SalesOperationsCubit>()
                              .setDeliveryQty(line.id, value),
                          onInvoiceChanged: (int value) => context
                              .read<SalesOperationsCubit>()
                              .setInvoiceQty(line.id, value),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: state.isSubmitting
                                  ? null
                                  : () => context
                                        .read<SalesOperationsCubit>()
                                        .submitPartialDelivery(
                                          note: _noteController.text,
                                        ),
                              icon: const Icon(Icons.local_shipping_outlined),
                              label: const Text('Post Delivery'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: state.isSubmitting
                                  ? null
                                  : () => context
                                        .read<SalesOperationsCubit>()
                                        .submitPartialInvoice(
                                          note: _noteController.text,
                                        ),
                              icon: const Icon(Icons.request_quote_outlined),
                              label: const Text('Create Invoice'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _LineFulfillmentRow extends StatelessWidget {
  const _LineFulfillmentRow({
    required this.line,
    required this.deliveryValue,
    required this.invoiceValue,
    required this.onDeliveryChanged,
    required this.onInvoiceChanged,
  });

  final SalesDocumentLine line;
  final int deliveryValue;
  final int invoiceValue;
  final ValueChanged<int> onDeliveryChanged;
  final ValueChanged<int> onInvoiceChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              line.productName,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              'Ordered ${line.quantity} | Delivered ${line.deliveredQuantity} | Invoiced ${line.invoicedQuantity}',
            ),
            const SizedBox(height: 8),
            Row(
              children: <Widget>[
                Expanded(
                  child: TextFormField(
                    key: ValueKey<String>('delivery-${line.id}'),
                    keyboardType: TextInputType.number,
                    initialValue: '$deliveryValue',
                    decoration: InputDecoration(
                      labelText: 'Deliver (max ${line.remainingToDeliver})',
                    ),
                    onChanged: (String value) {
                      onDeliveryChanged(int.tryParse(value) ?? 0);
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    key: ValueKey<String>('invoice-${line.id}'),
                    keyboardType: TextInputType.number,
                    initialValue: '$invoiceValue',
                    decoration: InputDecoration(
                      labelText: 'Invoice (max ${line.remainingToInvoice})',
                    ),
                    onChanged: (String value) {
                      onInvoiceChanged(int.tryParse(value) ?? 0);
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ArLedgerTab extends StatefulWidget {
  const _ArLedgerTab();

  @override
  State<_ArLedgerTab> createState() => _ArLedgerTabState();
}

class _ArLedgerTabState extends State<_ArLedgerTab> {
  final TextEditingController _amountController = TextEditingController();

  String? _selectedInvoiceId;
  String? _selectedWalletId;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SalesOperationsCubit, SalesOperationsState>(
      builder: (BuildContext context, SalesOperationsState state) {
        final FinanceArInvoice? selectedInvoice = _resolveInvoice(
          state.arInvoices,
          _selectedInvoiceId,
        );

        return ListView(
          padding: const EdgeInsets.all(12),
          children: <Widget>[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'AR Ledger & Payment Allocation',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _selectedInvoiceId,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Invoice',
                        prefixIcon: Icon(Icons.receipt),
                      ),
                      items: state.arInvoices
                          .where(
                            (FinanceArInvoice invoice) =>
                                invoice.balanceDue > 0,
                          )
                          .map(
                            (
                              FinanceArInvoice invoice,
                            ) => DropdownMenuItem<String>(
                              value: invoice.id,
                              child: Text(
                                '${invoice.documentNo} | Due \$${invoice.balanceDue.toStringAsFixed(2)}',
                              ),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) {
                        setState(() {
                          _selectedInvoiceId = value;
                          final FinanceArInvoice? invoice = _resolveInvoice(
                            state.arInvoices,
                            value,
                          );
                          if (invoice != null) {
                            _amountController.text = invoice.balanceDue
                                .toStringAsFixed(2);
                          }
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _selectedWalletId,
                      decoration: const InputDecoration(
                        labelText: 'Wallet / Cash account',
                        prefixIcon: Icon(Icons.account_balance_wallet_outlined),
                      ),
                      items: state.wallets
                          .map(
                            (FinanceWallet wallet) => DropdownMenuItem<String>(
                              value: wallet.id,
                              child: Text(
                                '${wallet.name} (${wallet.code}) - ${wallet.currency} ${wallet.balance.toStringAsFixed(2)}',
                              ),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) {
                        setState(() {
                          _selectedWalletId = value;
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _amountController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Allocation amount',
                        prefixIcon: Icon(Icons.payments_outlined),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: selectedInvoice == null || state.isSubmitting
                            ? null
                            : () => context
                                  .read<SalesOperationsCubit>()
                                  .allocatePayment(
                                    invoice: selectedInvoice,
                                    walletId: _selectedWalletId ?? '',
                                    amount:
                                        double.tryParse(
                                          _amountController.text.trim(),
                                        ) ??
                                        0,
                                  ),
                        icon: const Icon(Icons.send_outlined),
                        label: const Text('Allocate Payment'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Open Receivables',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    if (state.arInvoices.isEmpty)
                      const FeedbackPanel(message: 'No AR invoices found.')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.arInvoices.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final FinanceArInvoice row = state.arInvoices[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text(row.documentNo),
                            subtitle: Text(
                              'Status ${row.status.toUpperCase()} | Due date ${_dateLabel(row.dueDate)}',
                            ),
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: <Widget>[
                                Text(
                                  'Total \$${row.totalAmount.toStringAsFixed(2)}',
                                ),
                                Text(
                                  'Due \$${row.balanceDue.toStringAsFixed(2)}',
                                  style: TextStyle(
                                    color: row.balanceDue > 0
                                        ? Colors.red.shade700
                                        : Colors.green.shade700,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  FinanceArInvoice? _resolveInvoice(
    List<FinanceArInvoice> invoices,
    String? invoiceId,
  ) {
    if (invoiceId == null) {
      return null;
    }
    for (final FinanceArInvoice invoice in invoices) {
      if (invoice.id == invoiceId) {
        return invoice;
      }
    }
    return null;
  }
}

class _DraftOrderLine {
  const _DraftOrderLine({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.warehouseId,
  });

  final String productId;
  final String productName;
  final int quantity;
  final double unitPrice;
  final String? warehouseId;
}

String _dateLabel(DateTime? value) {
  if (value == null) {
    return '-';
  }
  final DateTime local = value.toLocal();
  final String month = local.month.toString().padLeft(2, '0');
  final String day = local.day.toString().padLeft(2, '0');
  return '${local.year}-$month-$day';
}
