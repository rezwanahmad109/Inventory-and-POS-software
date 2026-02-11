import '../../../core/api/api_client.dart';
import '../models/checkout_request_model.dart';
import '../models/customer_summary_model.dart';

class CheckoutRepository {
  CheckoutRepository({required this.apiClient});

  final ApiClient apiClient;

  Future<List<CustomerSummaryModel>> searchCustomers(String query) async {
    final data = await apiClient.get('customers', query: {'search': query, 'limit': '10'});
    final List<dynamic> list = data['data'] ?? [];
    return list.map((e) => CustomerSummaryModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<CustomerSummaryModel> getCustomerDetails(int id) async {
    final data = await apiClient.get('customers/$id');
    return CustomerSummaryModel.fromJson(data as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> submitSale(CheckoutRequestModel request) async {
    final data = await apiClient.post('sales', body: request.toJson());
    return data as Map<String, dynamic>;
  }

  Future<void> recordDepositUsage({
    required int customerId,
    required double amount,
    required String saleId,
  }) async {
    await apiClient.post('payments', body: {
      'customerId': customerId,
      'type': 'deposit_usage',
      'method': 'cash',
      'amount': amount,
      'saleId': saleId,
    });
  }
}
