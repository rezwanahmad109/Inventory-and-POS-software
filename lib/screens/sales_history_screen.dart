import 'package:flutter/material.dart';

const Color _kSalesPrimaryBlue = Color(0xFF1F4FFF);
const Color _kSalesAccentGold = Color(0xFFD4AF37);

/// Sales history screen (UI-only) for listing previous POS invoices.
class SalesHistoryScreen extends StatelessWidget {
  const SalesHistoryScreen({super.key});

  static const List<SaleHistoryItem> _mockSales = <SaleHistoryItem>[
    SaleHistoryItem(
      invoiceNo: 'INV-24001',
      dateTime: DateTime(2026, 2, 10, 10, 15),
      totalAmount: 154.75,
      paymentMethod: 'Cash',
      itemCount: 4,
    ),
    SaleHistoryItem(
      invoiceNo: 'INV-24002',
      dateTime: DateTime(2026, 2, 10, 12, 42),
      totalAmount: 89.40,
      paymentMethod: 'Card',
      itemCount: 2,
    ),
    SaleHistoryItem(
      invoiceNo: 'INV-24003',
      dateTime: DateTime(2026, 2, 9, 18, 5),
      totalAmount: 223.10,
      paymentMethod: 'Mobile Payment',
      itemCount: 6,
    ),
    SaleHistoryItem(
      invoiceNo: 'INV-24004',
      dateTime: DateTime(2026, 2, 9, 20, 21),
      totalAmount: 47.99,
      paymentMethod: 'Cash',
      itemCount: 1,
    ),
    SaleHistoryItem(
      invoiceNo: 'INV-24005',
      dateTime: DateTime(2026, 2, 8, 15, 34),
      totalAmount: 305.60,
      paymentMethod: 'Card',
      itemCount: 8,
    ),
  ];

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
        child: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final bool isDesktop = constraints.maxWidth >= 900;

            // Keep list centered and readable on large screens.
            return Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 980),
                child: ListView.separated(
                  padding: EdgeInsets.symmetric(
                    horizontal: isDesktop ? 24 : 12,
                    vertical: 14,
                  ),
                  itemCount: _mockSales.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (BuildContext context, int index) {
                    final SaleHistoryItem sale = _mockSales[index];
                    return _SaleHistoryCard(
                      sale: sale,
                      onTap: () {
                        // Placeholder action for future sale details route.
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              'Details for ${sale.invoiceNo} will be added soon.',
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _SaleHistoryCard extends StatelessWidget {
  const _SaleHistoryCard({
    required this.sale,
    required this.onTap,
  });

  final SaleHistoryItem sale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
      ),
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

  // Left section: invoice metadata.
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
            const Icon(Icons.payments_outlined, size: 16, color: Colors.black54),
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

  // Right section: total highlight.
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
