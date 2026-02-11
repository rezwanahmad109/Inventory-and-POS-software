class PermissionModel {
  const PermissionModel({
    required this.id,
    required this.module,
    required this.action,
    this.description,
  });

  final String id;
  final String module;
  final String action;
  final String? description;

  String get slug => '$module.$action';

  factory PermissionModel.fromJson(Map<String, dynamic> json) {
    final String module = '${json['module'] ?? ''}'.toLowerCase().trim();
    final String action = '${json['action'] ?? ''}'.toLowerCase().trim();

    return PermissionModel(
      id: '${json['id'] ?? ''}',
      module: module,
      action: action,
      description: json['description']?.toString(),
    );
  }
}
