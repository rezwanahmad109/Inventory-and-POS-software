import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const Color _kProductPrimaryBlue = Color(0xFF1F4FFF);
const Color _kProductAccentGold = Color(0xFFD4AF37);

/// Product details screen for viewing/editing product information.
///
/// UI-only implementation for now (no backend integration in this phase).
class ProductDetailsScreen extends StatefulWidget {
  const ProductDetailsScreen({super.key});

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  // Form key for optional validation hooks.
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  // Controllers for text-based fields.
  final TextEditingController _nameController =
      TextEditingController(text: 'Wireless Barcode Scanner');
  final TextEditingController _skuController =
      TextEditingController(text: 'SKU-1001');
  final TextEditingController _priceController =
      TextEditingController(text: '49.99');
  final TextEditingController _stockController =
      TextEditingController(text: '18');
  final TextEditingController _descriptionController = TextEditingController(
    text: 'Compact scanner for fast checkout and inventory counting.',
  );

  // Mock dropdown data.
  static const List<String> _categories = <String>[
    'Hardware',
    'Accessories',
    'Consumables',
    'Electronics',
    'Office Supplies',
  ];
  static const List<String> _units = <String>[
    'pcs',
    'kg',
    'liter',
    'box',
    'pack',
  ];

  String _selectedCategory = _categories.first;
  String _selectedUnit = _units.first;

  @override
  void dispose() {
    _nameController.dispose();
    _skuController.dispose();
    _priceController.dispose();
    _stockController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  void _saveProduct() {
    // Placeholder for future save workflow.
    // Form validation is optional for this phase.
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Product saved (mock action).')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Product Details'),
        backgroundColor: Colors.white,
        foregroundColor: _kProductPrimaryBlue,
        surfaceTintColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1100),
              child: Card(
                elevation: 1,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Form(
                    key: _formKey,
                    child: LayoutBuilder(
                      builder: (BuildContext context, BoxConstraints constraints) {
                        final bool isTwoColumn = constraints.maxWidth >= 820;

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            // Header section.
                            Text(
                              'Product Details',
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'View or edit product information used in inventory and POS checkout.',
                            ),
                            const SizedBox(height: 18),

                            // Responsive form section.
                            if (isTwoColumn) _buildTwoColumnForm() else _buildOneColumnForm(),

                            const SizedBox(height: 16),

                            // Image upload placeholder section.
                            _buildImagePlaceholder(),

                            const SizedBox(height: 18),

                            // Actions section.
                            Row(
                              children: <Widget>[
                                Expanded(
                                  child: FilledButton(
                                    style: FilledButton.styleFrom(
                                      backgroundColor: _kProductPrimaryBlue,
                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                    ),
                                    onPressed: _saveProduct,
                                    child: const Text('Save Product'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                TextButton(
                                  onPressed: () => Navigator.of(context).pop(),
                                  child: const Text('Cancel'),
                                ),
                              ],
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOneColumnForm() {
    return Column(
      children: <Widget>[
        _buildProductNameField(),
        const SizedBox(height: 12),
        _buildSkuField(),
        const SizedBox(height: 12),
        _buildCategoryField(),
        const SizedBox(height: 12),
        _buildPriceField(),
        const SizedBox(height: 12),
        _buildStockField(),
        const SizedBox(height: 12),
        _buildUnitField(),
        const SizedBox(height: 12),
        _buildDescriptionField(),
      ],
    );
  }

  Widget _buildTwoColumnForm() {
    return Column(
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(child: _buildProductNameField()),
            const SizedBox(width: 12),
            Expanded(child: _buildSkuField()),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            Expanded(child: _buildCategoryField()),
            const SizedBox(width: 12),
            Expanded(child: _buildUnitField()),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: <Widget>[
            Expanded(child: _buildPriceField()),
            const SizedBox(width: 12),
            Expanded(child: _buildStockField()),
          ],
        ),
        const SizedBox(height: 12),
        _buildDescriptionField(),
      ],
    );
  }

  // Product name input.
  Widget _buildProductNameField() {
    return TextFormField(
      controller: _nameController,
      textInputAction: TextInputAction.next,
      decoration: const InputDecoration(
        labelText: 'Product Name',
        prefixIcon: Icon(Icons.inventory_2_outlined),
      ),
    );
  }

  // SKU / code input.
  Widget _buildSkuField() {
    return TextFormField(
      controller: _skuController,
      textInputAction: TextInputAction.next,
      decoration: const InputDecoration(
        labelText: 'SKU / Code',
        prefixIcon: Icon(Icons.qr_code_2_outlined),
      ),
    );
  }

  // Category dropdown.
  Widget _buildCategoryField() {
    return DropdownButtonFormField<String>(
      value: _selectedCategory,
      decoration: const InputDecoration(
        labelText: 'Category',
        prefixIcon: Icon(Icons.category_outlined),
      ),
      items: _categories
          .map(
            (String category) => DropdownMenuItem<String>(
              value: category,
              child: Text(category),
            ),
          )
          .toList(growable: false),
      onChanged: (String? value) {
        if (value == null) return;
        setState(() => _selectedCategory = value);
      },
    );
  }

  // Price numeric input with subtle gold hint.
  Widget _buildPriceField() {
    return TextFormField(
      controller: _priceController,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: <TextInputFormatter>[
        FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}$')),
      ],
      decoration: InputDecoration(
        labelText: 'Price',
        prefixText: '\$',
        prefixStyle: const TextStyle(
          color: _kProductAccentGold,
          fontWeight: FontWeight.w700,
        ),
        prefixIcon: const Icon(Icons.attach_money_outlined),
      ),
    );
  }

  // Stock quantity numeric input.
  Widget _buildStockField() {
    return TextFormField(
      controller: _stockController,
      keyboardType: TextInputType.number,
      inputFormatters: <TextInputFormatter>[
        FilteringTextInputFormatter.digitsOnly,
      ],
      decoration: const InputDecoration(
        labelText: 'Stock Quantity',
        prefixIcon: Icon(Icons.numbers_outlined),
      ),
    );
  }

  // Unit of measure dropdown.
  Widget _buildUnitField() {
    return DropdownButtonFormField<String>(
      value: _selectedUnit,
      decoration: const InputDecoration(
        labelText: 'Unit of Measure',
        prefixIcon: Icon(Icons.straighten_outlined),
      ),
      items: _units
          .map(
            (String unit) => DropdownMenuItem<String>(
              value: unit,
              child: Text(unit),
            ),
          )
          .toList(growable: false),
      onChanged: (String? value) {
        if (value == null) return;
        setState(() => _selectedUnit = value);
      },
    );
  }

  // Description multiline input.
  Widget _buildDescriptionField() {
    return TextFormField(
      controller: _descriptionController,
      minLines: 4,
      maxLines: 6,
      decoration: const InputDecoration(
        labelText: 'Description',
        alignLabelWithHint: true,
        prefixIcon: Icon(Icons.description_outlined),
      ),
    );
  }

  // Placeholder UI for image upload area.
  Widget _buildImagePlaceholder() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blueGrey.withOpacity(0.35)),
        color: Colors.blueGrey.withOpacity(0.04),
      ),
      child: Column(
        children: <Widget>[
          const Icon(
            Icons.image_outlined,
            size: 36,
            color: _kProductPrimaryBlue,
          ),
          const SizedBox(height: 8),
          const Text(
            'Image Upload',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          const Text(
            'Upload product image (placeholder only)',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.black54),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.upload_file_outlined),
            label: const Text('Choose Image'),
          ),
        ],
      ),
    );
  }
}
