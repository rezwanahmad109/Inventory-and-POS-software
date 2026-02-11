import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/utils/currency_formatter.dart';
import '../bloc/checkout_cubit.dart';
import '../bloc/checkout_state.dart';
import '../models/customer_summary_model.dart';
import '../repository/checkout_repository.dart';
import '../../../core/api/api_client.dart';

class CustomerSelectorWidget extends StatefulWidget {
  const CustomerSelectorWidget({super.key});

  @override
  State<CustomerSelectorWidget> createState() => _CustomerSelectorWidgetState();
}

class _CustomerSelectorWidgetState extends State<CustomerSelectorWidget> {
  final TextEditingController _controller = TextEditingController();
  Timer? _debounce;
  List<CustomerSummaryModel> _suggestions = [];
  bool _isSearching = false;

  @override
  void dispose() {
    _controller.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounce?.cancel();
    if (query.trim().length < 2) {
      setState(() => _suggestions = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      setState(() => _isSearching = true);
      try {
        final repo = CheckoutRepository(apiClient: ApiClient());
        final results = await repo.searchCustomers(query.trim());
        if (mounted) setState(() => _suggestions = results);
      } catch (_) {
        if (mounted) setState(() => _suggestions = []);
      } finally {
        if (mounted) setState(() => _isSearching = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CheckoutCubit, CheckoutState>(
      buildWhen: (prev, curr) =>
          prev.selectedCustomer != curr.selectedCustomer ||
          prev.customerDetails != curr.customerDetails ||
          prev.isLoadingCustomer != curr.isLoadingCustomer,
      builder: (context, state) {
        return Card(
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Customer', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                TextField(
                  controller: _controller,
                  decoration: InputDecoration(
                    hintText: 'Search customer by name or phone...',
                    prefixIcon: const Icon(Icons.person_search_outlined),
                    suffixIcon: state.selectedCustomer != null
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _controller.clear();
                              setState(() => _suggestions = []);
                              context.read<CheckoutCubit>().selectCustomer(null);
                            },
                          )
                        : null,
                  ),
                  onChanged: _onSearchChanged,
                ),
                if (_isSearching)
                  const Padding(
                    padding: EdgeInsets.all(8),
                    child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                  ),
                if (_suggestions.isNotEmpty)
                  Container(
                    constraints: const BoxConstraints(maxHeight: 200),
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: _suggestions.length,
                      itemBuilder: (_, i) {
                        final c = _suggestions[i];
                        return ListTile(
                          dense: true,
                          title: Text(c.name),
                          subtitle: Text(c.phone),
                          trailing: Text('Due: ${CurrencyFormatter.format(c.totalDue)}'),
                          onTap: () {
                            _controller.text = c.name;
                            setState(() => _suggestions = []);
                            context.read<CheckoutCubit>().selectCustomer(c);
                          },
                        );
                      },
                    ),
                  ),
                if (state.selectedCustomer != null) ...[
                  const SizedBox(height: 8),
                  _CustomerInfoCard(
                    customer: state.customerDetails ?? state.selectedCustomer!,
                    isLoading: state.isLoadingCustomer,
                  ),
                ],
                if (state.selectedCustomer == null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Walk-in Customer',
                      style: TextStyle(color: Colors.grey.shade600, fontStyle: FontStyle.italic),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _CustomerInfoCard extends StatelessWidget {
  const _CustomerInfoCard({required this.customer, this.isLoading = false});

  final CustomerSummaryModel customer;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(12),
          child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.person, color: Color(0xFF1565C0)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(customer.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(customer.phone, style: TextStyle(color: Colors.grey.shade700, fontSize: 13)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('Deposit: ${CurrencyFormatter.format(customer.totalDeposit)}',
                  style: const TextStyle(color: Color(0xFF388E3C), fontSize: 12)),
              Text('Due: ${CurrencyFormatter.format(customer.totalDue)}',
                  style: const TextStyle(color: Color(0xFFD32F2F), fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }
}
