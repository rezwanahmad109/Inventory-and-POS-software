import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../app_config.dart';
import '../core/api/api_client.dart';

class AdminSettingsScreen extends StatefulWidget {
  const AdminSettingsScreen({required this.apiClient, super.key});

  final ApiClient apiClient;

  @override
  State<AdminSettingsScreen> createState() => _AdminSettingsScreenState();
}

class _AdminSettingsScreenState extends State<AdminSettingsScreen> {
  final TextEditingController _businessNameController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  final TextEditingController _contactEmailController = TextEditingController();
  final TextEditingController _contactPhoneController = TextEditingController();
  final TextEditingController _websiteController = TextEditingController();
  final TextEditingController _taxIdController = TextEditingController();

  final TextEditingController _invoiceHeaderController = TextEditingController();
  final TextEditingController _invoiceFooterController = TextEditingController();
  final TextEditingController _invoiceLogoUrlController = TextEditingController();
  final TextEditingController _invoicePrefixController = TextEditingController();
  final TextEditingController _invoiceNextNumberController = TextEditingController();

  final TextEditingController _taxNameController = TextEditingController();
  final TextEditingController _taxRateController = TextEditingController();

  final TextEditingController _discountRulesController = TextEditingController();

  final TextEditingController _stockThresholdController = TextEditingController();
  bool _allowStockTransfers = true;
  bool _allowNegativeStock = false;
  bool _autoReorderEnabled = false;
  bool _taxInclusive = false;

  List<Map<String, dynamic>> _auditLogs = <Map<String, dynamic>>[];
  bool _loading = true;
  bool _saving = false;
  String _exportDataset = 'settings';

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _businessNameController.dispose();
    _addressController.dispose();
    _contactEmailController.dispose();
    _contactPhoneController.dispose();
    _websiteController.dispose();
    _taxIdController.dispose();
    _invoiceHeaderController.dispose();
    _invoiceFooterController.dispose();
    _invoiceLogoUrlController.dispose();
    _invoicePrefixController.dispose();
    _invoiceNextNumberController.dispose();
    _taxNameController.dispose();
    _taxRateController.dispose();
    _discountRulesController.dispose();
    _stockThresholdController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
    });

    try {
      await Future.wait<void>(<Future<void>>[
        _loadBusinessProfile(),
        _loadInvoiceTemplate(),
        _loadTaxSettings(),
        _loadDiscountRules(),
        _loadStockPolicy(),
        _loadAuditLogs(),
      ]);
    } catch (error) {
      if (!mounted) return;
      _showSnack('Failed to load settings: $error');
    } finally {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _loadBusinessProfile() async {
    final dynamic response = await widget.apiClient.get('settings/business-profile');
    if (response is! Map<String, dynamic>) return;

    _businessNameController.text = (response['businessName'] ?? '').toString();
    _addressController.text = (response['address'] ?? '').toString();
    _contactEmailController.text = (response['contactEmail'] ?? '').toString();
    _contactPhoneController.text = (response['contactPhone'] ?? '').toString();
    _websiteController.text = (response['website'] ?? '').toString();
    _taxIdController.text = (response['taxId'] ?? '').toString();
  }

  Future<void> _loadInvoiceTemplate() async {
    final dynamic response = await widget.apiClient.get('settings/invoice-template');
    if (response is! Map<String, dynamic>) return;

    _invoiceHeaderController.text = (response['headerText'] ?? '').toString();
    _invoiceFooterController.text = (response['footerText'] ?? '').toString();
    _invoiceLogoUrlController.text = (response['logoUrl'] ?? '').toString();
    _invoicePrefixController.text = (response['invoicePrefix'] ?? '').toString();
    _invoiceNextNumberController.text = (response['nextNumber'] ?? '').toString();
  }

  Future<void> _loadTaxSettings() async {
    final dynamic response = await widget.apiClient.get('settings/tax');
    if (response is! List<dynamic> || response.isEmpty) return;

    final dynamic first = response.first;
    if (first is! Map<String, dynamic>) return;
    _taxNameController.text = (first['taxName'] ?? '').toString();
    _taxRateController.text = (first['taxRate'] ?? '').toString();
    _taxInclusive = first['isInclusive'] == true;
  }

  Future<void> _loadDiscountRules() async {
    final dynamic response = await widget.apiClient.get('settings/discount-rules');
    if (response is! List<dynamic>) return;
    _discountRulesController.text = const JsonEncoder.withIndent(
      '  ',
    ).convert(response);
  }

  Future<void> _loadStockPolicy() async {
    final dynamic response = await widget.apiClient.get('settings/stock-policy');
    if (response is! Map<String, dynamic>) return;

    _stockThresholdController.text =
        (response['defaultLowStockThreshold'] ?? 0).toString();
    _allowStockTransfers = response['allowStockTransfers'] != false;
    _allowNegativeStock = response['allowNegativeStock'] == true;
    _autoReorderEnabled = response['autoReorderEnabled'] == true;
  }

  Future<void> _loadAuditLogs() async {
    final dynamic response = await widget.apiClient.get(
      'settings/audit-logs',
      query: <String, String>{'limit': '25'},
    );
    if (response is! List<dynamic>) return;
    _auditLogs = response
        .whereType<Map<String, dynamic>>()
        .toList(growable: false);
  }

  Future<void> _saveBusinessProfile() async {
    await _withSaving(() async {
      await widget.apiClient.put(
        'settings/business-profile',
        body: <String, dynamic>{
          'businessName': _businessNameController.text.trim(),
          'address': _emptyToNull(_addressController.text),
          'contactEmail': _emptyToNull(_contactEmailController.text),
          'contactPhone': _emptyToNull(_contactPhoneController.text),
          'website': _emptyToNull(_websiteController.text),
          'taxId': _emptyToNull(_taxIdController.text),
        },
      );
      _showSnack('Business profile updated.');
    });
  }

  Future<void> _saveInvoiceTemplate() async {
    await _withSaving(() async {
      final int nextNumber = int.tryParse(
            _invoiceNextNumberController.text.trim(),
          ) ??
          1;

      await widget.apiClient.put(
        'settings/invoice-template',
        body: <String, dynamic>{
          'headerText': _emptyToNull(_invoiceHeaderController.text),
          'footerText': _emptyToNull(_invoiceFooterController.text),
          'logoUrl': _emptyToNull(_invoiceLogoUrlController.text),
          'invoicePrefix': _emptyToNull(_invoicePrefixController.text),
          'nextNumber': nextNumber,
        },
      );
      _showSnack('Invoice template updated.');
    });
  }

  Future<void> _saveTaxSettings() async {
    await _withSaving(() async {
      final double taxRate =
          double.tryParse(_taxRateController.text.trim()) ?? 0;
      await widget.apiClient.put(
        'settings/tax',
        body: <String, dynamic>{
          'rates': <Map<String, dynamic>>[
            <String, dynamic>{
              'taxName': _taxNameController.text.trim(),
              'taxRate': taxRate,
              'isInclusive': _taxInclusive,
            },
          ],
        },
      );
      _showSnack('Tax settings updated.');
    });
  }

  Future<void> _saveDiscountRules() async {
    await _withSaving(() async {
      final dynamic decoded = jsonDecode(_discountRulesController.text.trim());
      if (decoded is! List<dynamic>) {
        throw const FormatException('Discount rules JSON must be a list.');
      }

      await widget.apiClient.put(
        'settings/discount-rules',
        body: <String, dynamic>{'rules': decoded},
      );
      _showSnack('Discount rules updated.');
    });
  }

  Future<void> _saveStockPolicy() async {
    await _withSaving(() async {
      final int threshold = int.tryParse(_stockThresholdController.text.trim()) ?? 0;
      await widget.apiClient.put(
        'settings/stock-policy',
        body: <String, dynamic>{
          'defaultLowStockThreshold': threshold,
          'allowStockTransfers': _allowStockTransfers,
          'allowNegativeStock': _allowNegativeStock,
          'autoReorderEnabled': _autoReorderEnabled,
        },
      );
      _showSnack('Stock policy updated.');
    });
  }

  Future<void> _downloadExport(String format) async {
    await _withSaving(() async {
      final Uri uri = _buildUri(
        'export/$format',
        <String, String>{'dataset': _exportDataset},
      );

      final Map<String, String> headers = <String, String>{
        if (widget.apiClient.token != null)
          'Authorization': 'Bearer ${widget.apiClient.token}',
      };

      final http.Response response = await http.get(uri, headers: headers);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        _showSnack('Downloaded ${response.bodyBytes.length} bytes as $format.');
        return;
      }
      throw ApiException(response.statusCode, response.body);
    });
  }

  Uri _buildUri(String path, Map<String, String> query) {
    final Uri base = AppConfig.apiBaseUri;
    return base.replace(
      path: '${base.path}/$path'.replaceAll('//', '/'),
      queryParameters: query,
    );
  }

  Future<void> _withSaving(Future<void> Function() action) async {
    if (_saving) return;
    setState(() {
      _saving = true;
    });

    try {
      await action();
      await _loadAuditLogs();
    } catch (error) {
      if (!mounted) return;
      _showSnack('Operation failed: $error');
    } finally {
      if (!mounted) return;
      setState(() {
        _saving = false;
      });
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  String? _emptyToNull(String value) {
    final String trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Admin Settings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAll,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: <Widget>[
                  _SettingsSectionCard(
                    title: 'Business Profile',
                    children: <Widget>[
                      TextField(
                        key: const Key('business_name_field'),
                        controller: _businessNameController,
                        decoration: const InputDecoration(labelText: 'Business Name'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _addressController,
                        decoration: const InputDecoration(labelText: 'Address'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _contactEmailController,
                        decoration: const InputDecoration(labelText: 'Contact Email'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _contactPhoneController,
                        decoration: const InputDecoration(labelText: 'Contact Phone'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _websiteController,
                        decoration: const InputDecoration(labelText: 'Website'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _taxIdController,
                        decoration: const InputDecoration(labelText: 'Tax ID'),
                      ),
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton(
                          onPressed: _saving ? null : _saveBusinessProfile,
                          child: const Text('Save Business Profile'),
                        ),
                      ),
                    ],
                  ),
                  _SettingsSectionCard(
                    title: 'Invoice Template',
                    children: <Widget>[
                      TextField(
                        controller: _invoiceHeaderController,
                        decoration: const InputDecoration(labelText: 'Header Text'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _invoiceFooterController,
                        decoration: const InputDecoration(labelText: 'Footer Text'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _invoiceLogoUrlController,
                        decoration: const InputDecoration(labelText: 'Logo URL'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _invoicePrefixController,
                        decoration: const InputDecoration(labelText: 'Invoice Prefix'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _invoiceNextNumberController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Next Number'),
                      ),
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton(
                          onPressed: _saving ? null : _saveInvoiceTemplate,
                          child: const Text('Save Invoice Template'),
                        ),
                      ),
                    ],
                  ),
                  _SettingsSectionCard(
                    title: 'Tax / VAT Settings',
                    children: <Widget>[
                      TextField(
                        controller: _taxNameController,
                        decoration: const InputDecoration(labelText: 'Tax Name'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _taxRateController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Tax Rate (0.00 - 1.00)',
                        ),
                      ),
                      const SizedBox(height: 10),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Inclusive Tax'),
                        value: _taxInclusive,
                        onChanged: (bool value) {
                          setState(() {
                            _taxInclusive = value;
                          });
                        },
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton(
                          onPressed: _saving ? null : _saveTaxSettings,
                          child: const Text('Save Tax Settings'),
                        ),
                      ),
                    ],
                  ),
                  _SettingsSectionCard(
                    title: 'Discount Rules',
                    children: <Widget>[
                      TextField(
                        minLines: 6,
                        maxLines: 12,
                        controller: _discountRulesController,
                        decoration: const InputDecoration(
                          labelText: 'Rules JSON',
                          hintText:
                              '[{"name":"Weekend 10%","discountType":"percentage","value":10}]',
                        ),
                      ),
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton(
                          onPressed: _saving ? null : _saveDiscountRules,
                          child: const Text('Save Discount Rules'),
                        ),
                      ),
                    ],
                  ),
                  _SettingsSectionCard(
                    title: 'Stock Policy',
                    children: <Widget>[
                      TextField(
                        controller: _stockThresholdController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Default Low-Stock Threshold',
                        ),
                      ),
                      const SizedBox(height: 10),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Allow Stock Transfers'),
                        value: _allowStockTransfers,
                        onChanged: (bool value) {
                          setState(() {
                            _allowStockTransfers = value;
                          });
                        },
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Allow Negative Stock'),
                        value: _allowNegativeStock,
                        onChanged: (bool value) {
                          setState(() {
                            _allowNegativeStock = value;
                          });
                        },
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Auto Reorder Enabled'),
                        value: _autoReorderEnabled,
                        onChanged: (bool value) {
                          setState(() {
                            _autoReorderEnabled = value;
                          });
                        },
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton(
                          onPressed: _saving ? null : _saveStockPolicy,
                          child: const Text('Save Stock Policy'),
                        ),
                      ),
                    ],
                  ),
                  _SettingsSectionCard(
                    title: 'Audit Logs',
                    children: <Widget>[
                      Align(
                        alignment: Alignment.centerRight,
                        child: OutlinedButton.icon(
                          onPressed: _saving ? null : _loadAuditLogs,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Refresh Logs'),
                        ),
                      ),
                      if (_auditLogs.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text('No audit logs available.'),
                        ),
                      ..._auditLogs.map(
                        (Map<String, dynamic> log) => ListTile(
                          dense: true,
                          title: Text('${log['action'] ?? 'unknown'}'),
                          subtitle: Text(
                            '${log['entity'] ?? 'entity'} | ${log['createdAt'] ?? ''}',
                          ),
                        ),
                      ),
                    ],
                  ),
                  _SettingsSectionCard(
                    title: 'Export Data',
                    children: <Widget>[
                      DropdownButtonFormField<String>(
                        value: _exportDataset,
                        decoration: const InputDecoration(labelText: 'Dataset'),
                        items: const <DropdownMenuItem<String>>[
                          DropdownMenuItem<String>(
                            value: 'settings',
                            child: Text('Settings'),
                          ),
                          DropdownMenuItem<String>(
                            value: 'tax',
                            child: Text('Tax'),
                          ),
                          DropdownMenuItem<String>(
                            value: 'discount_rules',
                            child: Text('Discount Rules'),
                          ),
                          DropdownMenuItem<String>(
                            value: 'inventory_low_stock',
                            child: Text('Inventory Low Stock'),
                          ),
                        ],
                        onChanged: (String? value) {
                          if (value == null) return;
                          setState(() {
                            _exportDataset = value;
                          });
                        },
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: _saving ? null : () => _downloadExport('csv'),
                              icon: const Icon(Icons.table_view_outlined),
                              label: const Text('Export CSV'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _saving ? null : () => _downloadExport('pdf'),
                              icon: const Icon(Icons.picture_as_pdf_outlined),
                              label: const Text('Export PDF'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }
}

class _SettingsSectionCard extends StatelessWidget {
  const _SettingsSectionCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      ),
    );
  }
}
