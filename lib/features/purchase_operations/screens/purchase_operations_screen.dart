import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/api/api_client.dart';
import '../../../core/ui/feedback_panel.dart';
import '../../../core/ui/offline_status_banner.dart';
import '../bloc/purchase_operations_cubit.dart';
import '../bloc/purchase_operations_state.dart';
import '../repository/purchase_operations_repository.dart';

class PurchaseOperationsScreen extends StatelessWidget {
  const PurchaseOperationsScreen({required this.apiClient, super.key});

  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PurchaseOperationsCubit>(
      create: (_) => PurchaseOperationsCubit(
        repository: PurchaseOperationsRepository(apiClient: apiClient),
      )..loadAll(),
      child: _PurchaseOperationsView(apiClient: apiClient),
    );
  }
}

class _PurchaseOperationsView extends StatelessWidget {
  const _PurchaseOperationsView({required this.apiClient});

  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: BlocConsumer<PurchaseOperationsCubit, PurchaseOperationsState>(
        listener: (BuildContext context, PurchaseOperationsState state) {
          if (state.errorMessage != null && state.errorMessage!.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(_cleanError(state.errorMessage!))),
            );
            context.read<PurchaseOperationsCubit>().clearFeedback();
          }
          if (state.successMessage != null && state.successMessage!.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.successMessage!),
                backgroundColor: Colors.green.shade700,
              ),
            );
            context.read<PurchaseOperationsCubit>().clearFeedback();
          }
        },
        builder: (BuildContext context, PurchaseOperationsState state) {
          return Scaffold(
            appBar: AppBar(
              title: const Text('Purchase, GRN, AP & Returns'),
              bottom: const TabBar(
                isScrollable: true,
                tabs: <Tab>[
                  Tab(text: 'Suppliers'),
                  Tab(text: 'PO / Invoice'),
                  Tab(text: 'Receiving & Pay'),
                  Tab(text: 'Purchase Return'),
                ],
              ),
              actions: <Widget>[
                IconButton(
                  onPressed: state.isLoading
                      ? null
                      : () => context.read<PurchaseOperationsCubit>().loadAll(),
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
                        _SuppliersTab(),
                        _PurchaseDocumentsTab(),
                        _ReceivingAndPaymentTab(),
                        _PurchaseReturnTab(),
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

class _SuppliersTab extends StatefulWidget {
  const _SuppliersTab();

  @override
  State<_SuppliersTab> createState() => _SuppliersTabState();
}

class _SuppliersTabState extends State<_SuppliersTab> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _contactController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _contactController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PurchaseOperationsCubit, PurchaseOperationsState>(
      builder: (BuildContext context, PurchaseOperationsState state) {
        return ListView(
          padding: const EdgeInsets.all(12),
          children: <Widget>[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Create Supplier', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _nameController,
                      decoration: const InputDecoration(labelText: 'Supplier name'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _contactController,
                      decoration: const InputDecoration(labelText: 'Contact name'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _phoneController,
                      decoration: const InputDecoration(labelText: 'Phone'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _emailController,
                      decoration: const InputDecoration(labelText: 'Email'),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: state.isSubmitting
                            ? null
                            : () async {
                                await context.read<PurchaseOperationsCubit>().createSupplier(
                                      name: _nameController.text,
                                      contactName: _contactController.text,
                                      phone: _phoneController.text,
                                      email: _emailController.text,
                                    );
                                if (!mounted) return;
                                _nameController.clear();
                                _contactController.clear();
                                _phoneController.clear();
                                _emailController.clear();
                              },
                        icon: const Icon(Icons.add_business_outlined),
                        label: const Text('Save Supplier'),
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
                    Text('Suppliers', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    if (state.suppliers.isEmpty)
                      const FeedbackPanel(message: 'No suppliers found.')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.suppliers.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final SupplierModel supplier = state.suppliers[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.store_outlined),
                            title: Text(supplier.name),
                            subtitle: Text(
                              '${supplier.contactName ?? '-'} | ${supplier.phone ?? '-'} | ${supplier.email ?? '-'}',
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
}

class _PurchaseDocumentsTab extends StatefulWidget {
  const _PurchaseDocumentsTab();

  @override
  State<_PurchaseDocumentsTab> createState() => _PurchaseDocumentsTabState();
}

class _PurchaseDocumentsTabState extends State<_PurchaseDocumentsTab> {
  final TextEditingController _qtyController = TextEditingController(text: '1');
  final TextEditingController _priceController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();
  final List<_DraftPurchaseLine> _lines = <_DraftPurchaseLine>[];

  String? _supplierId;
  String? _productId;
  String? _warehouseId;

  @override
  void dispose() {
    _qtyController.dispose();
    _priceController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PurchaseOperationsCubit, PurchaseOperationsState>(
      builder: (BuildContext context, PurchaseOperationsState state) {
        return ListView(
          padding: const EdgeInsets.all(12),
          children: <Widget>[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Create Purchase Order / Invoice', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _supplierId,
                      decoration: const InputDecoration(labelText: 'Supplier'),
                      isExpanded: true,
                      items: state.suppliers
                          .map(
                            (SupplierModel supplier) => DropdownMenuItem<String>(
                              value: supplier.id,
                              child: Text(supplier.name),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) => setState(() {
                        _supplierId = value;
                      }),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: <Widget>[
                        Expanded(
                          flex: 4,
                          child: DropdownButtonFormField<String>(
                            value: _productId,
                            decoration: const InputDecoration(labelText: 'Product'),
                            items: state.products
                                .map(
                                  (ProductOption product) => DropdownMenuItem<String>(
                                    value: product.id,
                                    child: Text('${product.name} (${product.sku})'),
                                  ),
                                )
                                .toList(growable: false),
                            onChanged: (String? value) {
                              setState(() {
                                _productId = value;
                              });
                              final ProductOption? option = _findProduct(state.products, value);
                              if (option != null) {
                                _priceController.text = option.price.toStringAsFixed(2);
                                _warehouseId = option.defaultWarehouseId;
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
                          flex: 2,
                          child: TextField(
                            controller: _priceController,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: const InputDecoration(labelText: 'Unit price'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _warehouseId,
                      decoration: const InputDecoration(labelText: 'Warehouse'),
                      items: state.warehouses
                          .map(
                            (WarehouseModel warehouse) => DropdownMenuItem<String>(
                              value: warehouse.id,
                              child: Text(warehouse.name),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) => setState(() {
                        _warehouseId = value;
                      }),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: () => _addLine(state.products),
                      icon: const Icon(Icons.add),
                      label: const Text('Add Line'),
                    ),
                    if (_lines.isNotEmpty)
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _lines.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final _DraftPurchaseLine line = _lines[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text(line.productName),
                            subtitle: Text(
                              'Qty ${line.quantity} x \$${line.unitPrice.toStringAsFixed(2)}',
                            ),
                            trailing: IconButton(
                              onPressed: () => setState(() {
                                _lines.removeAt(index);
                              }),
                              icon: const Icon(Icons.delete_outline),
                            ),
                          );
                        },
                      ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _noteController,
                      maxLines: 2,
                      decoration: const InputDecoration(labelText: 'Note'),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: FilledButton(
                            onPressed: state.isSubmitting
                                ? null
                                : () => _submit(context, 'estimate'),
                            child: const Text('Create PO'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: state.isSubmitting
                                ? null
                                : () => _submit(context, 'bill'),
                            child: const Text('Create Invoice'),
                          ),
                        ),
                      ],
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
                    Text('Purchase Documents', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    if (state.purchases.isEmpty)
                      const FeedbackPanel(message: 'No purchases found.')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.purchases.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final PurchaseDocumentModel row = state.purchases[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text('${row.invoiceNumber} - ${row.supplierName}'),
                            subtitle: Text('${row.documentType} | ${row.status}'),
                            trailing: Text('Due \$${row.dueTotal.toStringAsFixed(2)}'),
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

  Future<void> _submit(BuildContext context, String documentType) async {
    await context.read<PurchaseOperationsCubit>().createPurchaseDocument(
          supplierId: _supplierId ?? '',
          documentType: documentType,
          lines: _lines
              .map(
                (_DraftPurchaseLine row) => CreatePurchaseLineInput(
                  productId: row.productId,
                  quantity: row.quantity,
                  unitPrice: row.unitPrice,
                  warehouseId: row.warehouseId,
                ),
              )
              .toList(growable: false),
          note: _noteController.text,
        );
    if (!mounted) {
      return;
    }
    setState(() {
      _lines.clear();
      _noteController.clear();
    });
  }

  void _addLine(List<ProductOption> products) {
    final ProductOption? product = _findProduct(products, _productId);
    final int qty = int.tryParse(_qtyController.text.trim()) ?? 0;
    final double price = double.tryParse(_priceController.text.trim()) ?? 0;
    if (product == null || qty <= 0 || price <= 0) {
      return;
    }
    setState(() {
      _lines.add(
        _DraftPurchaseLine(
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPrice: price,
          warehouseId: _warehouseId ?? product.defaultWarehouseId,
        ),
      );
    });
  }

  ProductOption? _findProduct(List<ProductOption> products, String? id) {
    if (id == null) return null;
    for (final ProductOption product in products) {
      if (product.id == id) return product;
    }
    return null;
  }
}

class _ReceivingAndPaymentTab extends StatefulWidget {
  const _ReceivingAndPaymentTab();

  @override
  State<_ReceivingAndPaymentTab> createState() => _ReceivingAndPaymentTabState();
}

class _ReceivingAndPaymentTabState extends State<_ReceivingAndPaymentTab> {
  final TextEditingController _paymentAmountController = TextEditingController();
  final TextEditingController _paymentReferenceController = TextEditingController();

  String? _selectedEstimateId;
  String? _selectedBillId;
  String _paymentMethod = 'bank';

  @override
  void dispose() {
    _paymentAmountController.dispose();
    _paymentReferenceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PurchaseOperationsCubit, PurchaseOperationsState>(
      builder: (BuildContext context, PurchaseOperationsState state) {
        return ListView(
          padding: const EdgeInsets.all(12),
          children: <Widget>[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Receiving (GRN)', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedEstimateId,
                      decoration: const InputDecoration(labelText: 'Purchase Order (estimate)'),
                      items: state.estimates
                          .map(
                            (PurchaseDocumentModel row) => DropdownMenuItem<String>(
                              value: row.id,
                              child: Text('${row.invoiceNumber} - ${row.supplierName}'),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) => setState(() {
                        _selectedEstimateId = value;
                      }),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: state.isSubmitting || _selectedEstimateId == null
                            ? null
                            : () => context
                                .read<PurchaseOperationsCubit>()
                                .convertEstimateToBill(_selectedEstimateId!),
                        icon: const Icon(Icons.inventory_outlined),
                        label: const Text('Post GRN and Convert to Bill'),
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
                    Text('Supplier Payment', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedBillId,
                      decoration: const InputDecoration(labelText: 'Purchase invoice'),
                      items: state.bills
                          .map(
                            (PurchaseDocumentModel row) => DropdownMenuItem<String>(
                              value: row.id,
                              child: Text(
                                '${row.invoiceNumber} - ${row.supplierName} | Due \$${row.dueTotal.toStringAsFixed(2)}',
                              ),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) {
                        setState(() {
                          _selectedBillId = value;
                        });
                        final PurchaseDocumentModel? bill = _findById(state.bills, value);
                        if (bill != null) {
                          _paymentAmountController.text = bill.dueTotal.toStringAsFixed(2);
                        }
                      },
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _paymentMethod,
                      decoration: const InputDecoration(labelText: 'Payment method'),
                      items: const <DropdownMenuItem<String>>[
                        DropdownMenuItem<String>(value: 'bank', child: Text('Bank Transfer')),
                        DropdownMenuItem<String>(value: 'cash', child: Text('Cash')),
                        DropdownMenuItem<String>(value: 'card', child: Text('Card')),
                        DropdownMenuItem<String>(value: 'mobile', child: Text('Mobile')),
                      ],
                      onChanged: (String? value) {
                        setState(() {
                          _paymentMethod = value ?? 'bank';
                        });
                      },
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _paymentAmountController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Amount'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _paymentReferenceController,
                      decoration: const InputDecoration(labelText: 'Reference'),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: state.isSubmitting || _selectedBillId == null
                            ? null
                            : () => context.read<PurchaseOperationsCubit>().recordSupplierPayment(
                                  purchaseId: _selectedBillId!,
                                  amount:
                                      double.tryParse(_paymentAmountController.text.trim()) ??
                                          0,
                                  method: _paymentMethod,
                                  reference: _paymentReferenceController.text,
                                ),
                        icon: const Icon(Icons.payments_outlined),
                        label: const Text('Record Payment'),
                      ),
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

  PurchaseDocumentModel? _findById(
    List<PurchaseDocumentModel> rows,
    String? value,
  ) {
    if (value == null) {
      return null;
    }
    for (final PurchaseDocumentModel row in rows) {
      if (row.id == value) {
        return row;
      }
    }
    return null;
  }
}

class _PurchaseReturnTab extends StatefulWidget {
  const _PurchaseReturnTab();

  @override
  State<_PurchaseReturnTab> createState() => _PurchaseReturnTabState();
}

class _PurchaseReturnTabState extends State<_PurchaseReturnTab> {
  final TextEditingController _noteController = TextEditingController();
  final Map<String, TextEditingController> _qtyControllers =
      <String, TextEditingController>{};

  String? _purchaseId;

  @override
  void dispose() {
    _noteController.dispose();
    for (final TextEditingController controller in _qtyControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PurchaseOperationsCubit, PurchaseOperationsState>(
      builder: (BuildContext context, PurchaseOperationsState state) {
        final PurchaseDocumentModel? purchase = _findById(state.bills, _purchaseId);

        return ListView(
          padding: const EdgeInsets.all(12),
          children: <Widget>[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Create Purchase Return', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _purchaseId,
                      decoration: const InputDecoration(labelText: 'Purchase invoice'),
                      items: state.bills
                          .map(
                            (PurchaseDocumentModel row) => DropdownMenuItem<String>(
                              value: row.id,
                              child: Text('${row.invoiceNumber} - ${row.supplierName}'),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) {
                        setState(() {
                          _purchaseId = value;
                          _reseedControllers(_findById(state.bills, value));
                        });
                      },
                    ),
                    const SizedBox(height: 8),
                    if (purchase == null)
                      const FeedbackPanel(
                        message: 'Select a purchase invoice to return items.',
                      )
                    else ...<Widget>[
                      ...purchase.items.map(
                        (PurchaseLineModel line) => Row(
                          children: <Widget>[
                            Expanded(child: Text(line.productName)),
                            const SizedBox(width: 8),
                            SizedBox(
                              width: 90,
                              child: TextField(
                                controller: _controllerFor(line.id),
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(
                                  labelText: 'Max ${line.quantity}',
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _noteController,
                        maxLines: 2,
                        decoration: const InputDecoration(labelText: 'Return note'),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: state.isSubmitting
                              ? null
                              : () => _submitReturn(context, purchase),
                          icon: const Icon(Icons.assignment_return_outlined),
                          label: const Text('Submit Purchase Return'),
                        ),
                      ),
                    ],
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
                    Text('Recent Purchase Returns', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    if (state.purchaseReturns.isEmpty)
                      const FeedbackPanel(message: 'No purchase returns recorded.')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.purchaseReturns.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final PurchaseReturnModel row = state.purchaseReturns[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text(row.id),
                            subtitle: Text(
                              'Purchase ${row.originalPurchaseId} | ${_dateLabel(row.createdAt)}',
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

  Future<void> _submitReturn(
    BuildContext context,
    PurchaseDocumentModel purchase,
  ) async {
    final List<Map<String, dynamic>> rows = <Map<String, dynamic>>[];
    for (final PurchaseLineModel line in purchase.items) {
      final int qty = int.tryParse(_controllerFor(line.id).text.trim()) ?? 0;
      if (qty <= 0) continue;
      if (qty > line.quantity) continue;
      rows.add(
        <String, dynamic>{
          'productId': line.productId,
          'quantity': qty,
          if (line.warehouseId != null) 'warehouseId': line.warehouseId,
        },
      );
    }
    await context.read<PurchaseOperationsCubit>().createPurchaseReturn(
          originalPurchaseId: purchase.id,
          items: rows,
          note: _noteController.text,
        );
  }

  TextEditingController _controllerFor(String lineId) {
    return _qtyControllers.putIfAbsent(lineId, () => TextEditingController(text: '0'));
  }

  void _reseedControllers(PurchaseDocumentModel? purchase) {
    if (purchase == null) {
      return;
    }
    for (final PurchaseLineModel line in purchase.items) {
      _controllerFor(line.id).text = '0';
    }
  }

  PurchaseDocumentModel? _findById(
    List<PurchaseDocumentModel> rows,
    String? value,
  ) {
    if (value == null) return null;
    for (final PurchaseDocumentModel row in rows) {
      if (row.id == value) {
        return row;
      }
    }
    return null;
  }
}

class _DraftPurchaseLine {
  const _DraftPurchaseLine({
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
