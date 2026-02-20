import 'package:flutter/material.dart';

import '../core/api/api_client.dart';

const Color _kSalesPrimaryBlue = Color(0xFF1F4FFF);
const Color _kSalesAccentGold = Color(0xFFD4AF37);

class SalesHistoryScreen extends StatefulWidget {
  const SalesHistoryScreen({required this.apiClient, super.key});

  final ApiClient apiClient;

  @override
  State<SalesHistoryScreen> createState() => _SalesHistoryScreenState();
}

class _SalesHistoryScreenState extends State<SalesHistoryScreen> {
  final TextEditingController _branchController = TextEditingController();

  bool _loading = true;
  String? _error;
  int _page = 1;
  int _totalPages = 1;
  DateTimeRange? _dateRange;
  List<SaleHistoryItem> _records = const <SaleHistoryItem>[];

  @override
  void initState() {
    super.initState();
    _loadSales();
  }

  @override
  void dispose() {
    _branchController.dispose();
    super.dispose();
  }

  Future<void> _loadSales() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final Map<String, String> query = <String, String>{
        'page': _page.toString(),
        'limit': '20',
      };
      final String branchId = _branchController.text.trim();
      if (branchId.isNotEmpty) {
        query['branchId'] = branchId;
      }
      if (_dateRange != null) {
        query['from'] = _dateRange!.start.toUtc().toIso8601String();
        query['to'] = _dateRange!.end.toUtc().toIso8601String();
      }

      final dynamic response = await widget.apiClient.get(
        'sales',
        query: query,
      );

      final List<dynamic> rows = _extractRows(response);
      final Map<String, dynamic>? meta = _extractMeta(response);

      final List<SaleHistoryItem> parsed = rows
          .whereType<Map<String, dynamic>>()
          .map(_toSaleHistoryItem)
          .toList(growable: false);

      setState(() {
        _records = parsed;
        _totalPages = (meta?['totalPages'] as num?)?.toInt() ?? 1;
        _loading = false;
      });
    } on ApiException catch (error) {
      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Failed to load sales history.';
        _loading = false;
      });
    }
  }

  List<dynamic> _extractRows(dynamic response) {
    if (response is List<dynamic>) {
      return response;
    }
    if (response is Map<String, dynamic>) {
      final dynamic rows =
          response['items'] ?? response['rows'] ?? response['data'];
      if (rows is List<dynamic>) {
        return rows;
      }
      if (rows is Map<String, dynamic>) {
        final dynamic nested = rows['items'];
        if (nested is List<dynamic>) {
          return nested;
        }
      }
    }
    return const <dynamic>[];
  }

  Map<String, dynamic>? _extractMeta(dynamic response) {
    if (response is Map<String, dynamic>) {
      final dynamic meta = response['meta'];
      if (meta is Map<String, dynamic>) {
        return meta;
      }
      final dynamic nested = response['data'];
      if (nested is Map<String, dynamic> &&
          nested['meta'] is Map<String, dynamic>) {
        return nested['meta'] as Map<String, dynamic>;
      }
    }
    return null;
  }

  SaleHistoryItem _toSaleHistoryItem(Map<String, dynamic> row) {
    final String invoiceNo = row['invoiceNumber']?.toString() ?? 'Unknown';
    final DateTime? createdAt = DateTime.tryParse(
      row['createdAt']?.toString() ?? '',
    );
    final double amount =
        (row['grandTotal'] as num?)?.toDouble() ??
        (row['totalAmount'] as num?)?.toDouble() ??
        0;
    final String paymentMethod =
        row['paymentMethod']?.toString() ??
        row['legacyPaymentMethod']?.toString() ??
        'Unknown';
    final int itemCount = (row['items'] as List<dynamic>?)?.length ?? 0;

    return SaleHistoryItem(
      invoiceNo: invoiceNo,
      dateTime: createdAt ?? DateTime.now(),
      totalAmount: amount,
      paymentMethod: paymentMethod,
      itemCount: itemCount,
    );
  }

  Future<void> _pickDateRange() async {
    final DateTime now = DateTime.now();
    final DateTimeRange? selected = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 3),
      lastDate: DateTime(now.year + 1),
      initialDateRange: _dateRange,
    );
    if (selected == null) return;
    setState(() {
      _dateRange = selected;
      _page = 1;
    });
    await _loadSales();
  }

  Future<void> _applyFilters() async {
    setState(() => _page = 1);
    await _loadSales();
  }

  Future<void> _goToPage(int nextPage) async {
    if (nextPage < 1 || nextPage > _totalPages) return;
    setState(() => _page = nextPage);
    await _loadSales();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Sales History'),
        backgroundColor: Colors.white,
        foregroundColor: _kSalesPrimaryBlue,
        surfaceTintColor: Colors.white,
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            _SalesFilterBar(
              branchController: _branchController,
              dateRange: _dateRange,
              onPickDateRange: () {
                _pickDateRange();
              },
              onApplyFilters: () {
                _applyFilters();
              },
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                  ? Center(
                      child: Text(
                        _error!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    )
                  : _records.isEmpty
                  ? const Center(child: Text('No sales found.'))
                  : RefreshIndicator(
                      onRefresh: _loadSales,
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        itemCount: _records.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (BuildContext context, int index) {
                          final SaleHistoryItem sale = _records[index];
                          return _SaleHistoryCard(sale: sale, onTap: () {});
                        },
                      ),
                    ),
            ),
            if (!_loading)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: <Widget>[
                    OutlinedButton(
                      onPressed: _page <= 1 ? null : () => _goToPage(_page - 1),
                      child: const Text('Prev'),
                    ),
                    const SizedBox(width: 8),
                    Text('Page $_page / $_totalPages'),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: _page >= _totalPages
                          ? null
                          : () => _goToPage(_page + 1),
                      child: const Text('Next'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SalesFilterBar extends StatelessWidget {
  const _SalesFilterBar({
    required this.branchController,
    required this.dateRange,
    required this.onPickDateRange,
    required this.onApplyFilters,
  });

  final TextEditingController branchController;
  final DateTimeRange? dateRange;
  final VoidCallback onPickDateRange;
  final VoidCallback onApplyFilters;

  @override
  Widget build(BuildContext context) {
    final String dateLabel = dateRange == null
        ? 'Select date range'
        : '${dateRange!.start.toLocal().toString().split(' ').first} - ${dateRange!.end.toLocal().toString().split(' ').first}';

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          final bool compact = constraints.maxWidth < 640;
          final Widget branchField = TextField(
            controller: branchController,
            decoration: const InputDecoration(
              labelText: 'Branch ID (optional)',
              prefixIcon: Icon(Icons.store_mall_directory_outlined),
            ),
          );

          final Widget controls = Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onPickDateRange,
                  icon: const Icon(Icons.date_range_outlined),
                  label: Text(dateLabel, overflow: TextOverflow.ellipsis),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: onApplyFilters,
                child: const Text('Apply'),
              ),
            ],
          );

          if (compact) {
            return Column(
              children: <Widget>[
                branchField,
                const SizedBox(height: 8),
                controls,
              ],
            );
          }

          return Row(
            children: <Widget>[
              Expanded(flex: 2, child: branchField),
              const SizedBox(width: 8),
              Expanded(flex: 3, child: controls),
            ],
          );
        },
      ),
    );
  }
}

class _SaleHistoryCard extends StatelessWidget {
  const _SaleHistoryCard({required this.sale, required this.onTap});

  final SaleHistoryItem sale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final bool compact = constraints.maxWidth < 460;

              if (compact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    _buildPrimaryInfo(context),
                    const SizedBox(height: 10),
                    _buildAmountInfo(),
                  ],
                );
              }

              return Row(
                children: <Widget>[
                  Expanded(child: _buildPrimaryInfo(context)),
                  const SizedBox(width: 12),
                  _buildAmountInfo(),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildPrimaryInfo(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          sale.invoiceNo,
          style: const TextStyle(
            color: _kSalesPrimaryBlue,
            fontWeight: FontWeight.w700,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: <Widget>[
            const Icon(Icons.schedule, size: 16, color: Colors.black54),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                _formatDateTime(sale.dateTime),
                style: const TextStyle(color: Colors.black54),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          children: <Widget>[
            const Icon(
              Icons.payments_outlined,
              size: 16,
              color: Colors.black54,
            ),
            const SizedBox(width: 6),
            Text(
              sale.paymentMethod,
              style: const TextStyle(color: Colors.black87),
            ),
            const SizedBox(width: 10),
            Text(
              '${sale.itemCount} item(s)',
              style: const TextStyle(color: Colors.black54),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAmountInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        const Text(
          'Total',
          style: TextStyle(color: Colors.black54, fontSize: 12),
        ),
        const SizedBox(height: 2),
        Text(
          '\$${sale.totalAmount.toStringAsFixed(2)}',
          style: const TextStyle(
            color: _kSalesAccentGold,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
      ],
    );
  }
}

class SaleHistoryItem {
  const SaleHistoryItem({
    required this.invoiceNo,
    required this.dateTime,
    required this.totalAmount,
    required this.paymentMethod,
    required this.itemCount,
  });

  final String invoiceNo;
  final DateTime dateTime;
  final double totalAmount;
  final String paymentMethod;
  final int itemCount;
}

String _formatDateTime(DateTime dateTime) {
  const List<String> months = <String>[
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  final int hour = dateTime.hour == 0
      ? 12
      : (dateTime.hour > 12 ? dateTime.hour - 12 : dateTime.hour);
  final String minute = dateTime.minute.toString().padLeft(2, '0');
  final String period = dateTime.hour >= 12 ? 'PM' : 'AM';

  return '${dateTime.day} ${months[dateTime.month - 1]} ${dateTime.year}, $hour:$minute $period';
}
