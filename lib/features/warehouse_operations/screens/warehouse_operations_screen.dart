import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/api/api_client.dart';
import '../../../core/ui/feedback_panel.dart';
import '../../../core/ui/offline_status_banner.dart';
import '../bloc/warehouse_operations_cubit.dart';
import '../bloc/warehouse_operations_state.dart';
import '../repository/warehouse_operations_repository.dart';

class WarehouseOperationsScreen extends StatelessWidget {
  const WarehouseOperationsScreen({required this.apiClient, super.key});

  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<WarehouseOperationsCubit>(
      create: (_) => WarehouseOperationsCubit(
        repository: WarehouseOperationsRepository(apiClient: apiClient),
      )..loadAll(),
      child: _WarehouseOperationsView(apiClient: apiClient),
    );
  }
}

class _WarehouseOperationsView extends StatelessWidget {
  const _WarehouseOperationsView({required this.apiClient});

  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: BlocConsumer<WarehouseOperationsCubit, WarehouseOperationsState>(
        listener: (BuildContext context, WarehouseOperationsState state) {
          if (state.errorMessage != null && state.errorMessage!.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(_cleanError(state.errorMessage!))),
            );
            context.read<WarehouseOperationsCubit>().clearFeedback();
          }
          if (state.successMessage != null && state.successMessage!.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.successMessage!),
                backgroundColor: Colors.green.shade700,
              ),
            );
            context.read<WarehouseOperationsCubit>().clearFeedback();
          }
        },
        builder: (BuildContext context, WarehouseOperationsState state) {
          return Scaffold(
            appBar: AppBar(
              title: const Text('Warehouse Transfer & Inventory Adjustments'),
              bottom: const TabBar(
                tabs: <Tab>[
                  Tab(text: 'Stock & Value'),
                  Tab(text: 'Transfers'),
                  Tab(text: 'Adjustments'),
                ],
              ),
              actions: <Widget>[
                IconButton(
                  onPressed: state.isLoading
                      ? null
                      : () => context.read<WarehouseOperationsCubit>().loadAll(),
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
                        _StockLevelsTab(),
                        _TransfersTab(),
                        _AdjustmentsTab(),
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

class _StockLevelsTab extends StatelessWidget {
  const _StockLevelsTab();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WarehouseOperationsCubit, WarehouseOperationsState>(
      builder: (BuildContext context, WarehouseOperationsState state) {
        return ListView(
          padding: const EdgeInsets.all(12),
          children: <Widget>[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Warehouse Stock Levels', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: state.selectedWarehouseId,
                      decoration: const InputDecoration(labelText: 'Warehouse filter'),
                      items: <DropdownMenuItem<String>>[
                        const DropdownMenuItem<String>(
                          value: null,
                          child: Text('All warehouses'),
                        ),
                        ...state.warehouses.map(
                          (WarehouseOption row) => DropdownMenuItem<String>(
                            value: row.id,
                            child: Text(row.name),
                          ),
                        ),
                      ],
                      onChanged: (String? value) {
                        context.read<WarehouseOperationsCubit>().loadAll(warehouseId: value);
                      },
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Total valuation: \$${state.totalStockValue.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
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
                    Text('Per-Warehouse Inventory', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    if (state.stockLevels.isEmpty)
                      const FeedbackPanel(message: 'No stock rows found.')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.stockLevels.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final WarehouseStockLevel row = state.stockLevels[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.inventory_2_outlined),
                            title: Text('${row.productName} (${row.sku})'),
                            subtitle: Text(
                              '${row.branchName} | Qty ${row.stockQuantity} | Avg \$${row.averageCost.toStringAsFixed(2)}',
                            ),
                            trailing: Text('\$${row.stockValue.toStringAsFixed(2)}'),
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

class _TransfersTab extends StatefulWidget {
  const _TransfersTab();

  @override
  State<_TransfersTab> createState() => _TransfersTabState();
}

class _TransfersTabState extends State<_TransfersTab> {
  final TextEditingController _qtyController = TextEditingController(text: '1');
  final TextEditingController _noteController = TextEditingController();

  String? _fromId;
  String? _toId;
  String? _productId;

  @override
  void dispose() {
    _qtyController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WarehouseOperationsCubit, WarehouseOperationsState>(
      builder: (BuildContext context, WarehouseOperationsState state) {
        return ListView(
          padding: const EdgeInsets.all(12),
          children: <Widget>[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Create Stock Transfer', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _fromId,
                      decoration: const InputDecoration(labelText: 'From warehouse'),
                      items: state.warehouses
                          .map(
                            (WarehouseOption row) => DropdownMenuItem<String>(
                              value: row.id,
                              child: Text(row.name),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) => setState(() {
                        _fromId = value;
                      }),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _toId,
                      decoration: const InputDecoration(labelText: 'To warehouse'),
                      items: state.warehouses
                          .map(
                            (WarehouseOption row) => DropdownMenuItem<String>(
                              value: row.id,
                              child: Text(row.name),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) => setState(() {
                        _toId = value;
                      }),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _productId,
                      decoration: const InputDecoration(labelText: 'Product'),
                      items: state.products
                          .map(
                            (ProductOption row) => DropdownMenuItem<String>(
                              value: row.id,
                              child: Text('${row.name} (${row.sku})'),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) => setState(() {
                        _productId = value;
                      }),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _qtyController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Quantity'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _noteController,
                      maxLines: 2,
                      decoration: const InputDecoration(labelText: 'Note'),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: state.isSubmitting
                            ? null
                            : () => context.read<WarehouseOperationsCubit>().createTransfer(
                                  fromBranchId: _fromId ?? '',
                                  toBranchId: _toId ?? '',
                                  productId: _productId ?? '',
                                  quantity: int.tryParse(_qtyController.text.trim()) ?? 0,
                                  note: _noteController.text,
                                ),
                        icon: const Icon(Icons.swap_horiz_outlined),
                        label: const Text('Create Transfer'),
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
                    Text('Transfer History', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    if (state.transfers.isEmpty)
                      const FeedbackPanel(message: 'No transfers recorded.')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.transfers.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final StockTransferModel row = state.transfers[index];
                          return _TransferTile(row: row);
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

class _AdjustmentsTab extends StatefulWidget {
  const _AdjustmentsTab();

  @override
  State<_AdjustmentsTab> createState() => _AdjustmentsTabState();
}

class _AdjustmentsTabState extends State<_AdjustmentsTab> {
  final TextEditingController _deltaController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();
  String? _productId;
  String? _branchId;
  String _reason = 'correction';

  @override
  void dispose() {
    _deltaController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<WarehouseOperationsCubit, WarehouseOperationsState>(
      builder: (BuildContext context, WarehouseOperationsState state) {
        final List<StockTransferModel> transfersWithCost = state.transfers
            .where((StockTransferModel row) => row.costSnapshot.isNotEmpty)
            .toList(growable: false);

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
                      'Inventory Adjustments (Stock Count / Write-off)',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _productId,
                      decoration: const InputDecoration(labelText: 'Product'),
                      items: state.products
                          .map(
                            (ProductOption row) => DropdownMenuItem<String>(
                              value: row.id,
                              child: Text('${row.name} (${row.sku})'),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) => setState(() {
                        _productId = value;
                      }),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _branchId,
                      decoration: const InputDecoration(labelText: 'Warehouse'),
                      items: state.warehouses
                          .map(
                            (WarehouseOption row) => DropdownMenuItem<String>(
                              value: row.id,
                              child: Text(row.name),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) => setState(() {
                        _branchId = value;
                      }),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _reason,
                      decoration: const InputDecoration(labelText: 'Reason'),
                      items: const <DropdownMenuItem<String>>[
                        DropdownMenuItem<String>(
                          value: 'correction',
                          child: Text('Stock Count Correction'),
                        ),
                        DropdownMenuItem<String>(
                          value: 'damage',
                          child: Text('Damage / Write-off'),
                        ),
                        DropdownMenuItem<String>(
                          value: 'expiry',
                          child: Text('Expiry Write-off'),
                        ),
                      ],
                      onChanged: (String? value) => setState(() {
                        _reason = value ?? 'correction';
                      }),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _deltaController,
                      keyboardType: const TextInputType.numberWithOptions(signed: true),
                      decoration: const InputDecoration(
                        labelText: 'Quantity delta (+/-)',
                        hintText: 'Example: +5 stock count, -2 damage',
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _noteController,
                      maxLines: 2,
                      decoration: const InputDecoration(labelText: 'Note'),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: state.isSubmitting
                            ? null
                            : () => context.read<WarehouseOperationsCubit>().postAdjustment(
                                  productId: _productId ?? '',
                                  qtyDelta: int.tryParse(_deltaController.text.trim()) ?? 0,
                                  reason: _reason,
                                  branchId: _branchId,
                                  note: _noteController.text,
                                ),
                        icon: const Icon(Icons.playlist_add_check_circle_outlined),
                        label: const Text('Post Adjustment'),
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
                      'FIFO / Average Cost Layers (Available snapshots)',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    if (transfersWithCost.isEmpty)
                      const FeedbackPanel(
                        message:
                            'No cost-layer snapshots found yet. Transfer approvals with FIFO consumption will appear here.',
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: transfersWithCost.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final StockTransferModel transfer = transfersWithCost[index];
                          final double total = transfer.costSnapshot.fold<double>(
                            0,
                            (double sum, TransferCostLayer row) => sum + row.totalCost,
                          );
                          final int totalQty = transfer.costSnapshot.fold<int>(
                            0,
                            (int sum, TransferCostLayer row) => sum + row.quantity,
                          );
                          final double average = totalQty > 0 ? total / totalQty : 0;

                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              '${transfer.productName} | ${transfer.fromBranchName} -> ${transfer.toBranchName}',
                            ),
                            subtitle: Text(
                              'FIFO layers ${transfer.costSnapshot.length} | Avg cost \$${average.toStringAsFixed(4)}',
                            ),
                            trailing: Text('\$${total.toStringAsFixed(2)}'),
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

class _TransferTile extends StatelessWidget {
  const _TransferTile({required this.row});

  final StockTransferModel row;

  @override
  Widget build(BuildContext context) {
    final WarehouseOperationsCubit cubit = context.read<WarehouseOperationsCubit>();
    final bool isPending = row.status == 'pending_approval';
    final bool isApproved = row.status == 'approved';

    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      title: Text(
        '${row.productName} | ${row.fromBranchName} -> ${row.toBranchName}',
      ),
      subtitle: Text(
        'Qty ${row.quantity} | ${row.status.toUpperCase()} | ${_dateLabel(row.timestamp)}',
      ),
      trailing: Wrap(
        spacing: 6,
        children: <Widget>[
          if (isPending)
            OutlinedButton(
              onPressed: () => cubit.approveTransfer(row.id),
              child: const Text('Approve'),
            ),
          if (isApproved)
            FilledButton(
              onPressed: () => cubit.receiveTransfer(row.id),
              child: const Text('Receive'),
            ),
        ],
      ),
    );
  }
}

String _dateLabel(DateTime? value) {
  if (value == null) return '-';
  final DateTime local = value.toLocal();
  final String month = local.month.toString().padLeft(2, '0');
  final String day = local.day.toString().padLeft(2, '0');
  return '${local.year}-$month-$day';
}
