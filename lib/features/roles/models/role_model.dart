class RoleModel {
  const RoleModel({
    required this.id,
    required this.name,
    this.description,
    this.createdById,
    this.isSystem = false,
  });

  final String id;
  final String name;
  final String? description;
  final String? createdById;
  final bool isSystem;

  factory RoleModel.fromJson(Map<String, dynamic> json) {
    return RoleModel(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      description: json['description']?.toString(),
      createdById: json['createdById']?.toString() ??
          json['created_by_id']?.toString(),
      isSystem: json['isSystem'] == true || json['is_system'] == true,
    );
  }
}
