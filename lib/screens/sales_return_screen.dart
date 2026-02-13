import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../core/api/api_client.dart';
import '../features/returns/bloc/returns_cubit.dart';
import '../features/returns/repository/returns_repository.dart';
import '../features/returns/widgets/returns_screen_body.dart';

class SalesReturnScreen extends StatelessWidget {
  const SalesReturnScreen({required this.apiClient, super.key});

  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ReturnsCubit>(
      create: (_) => ReturnsCubit(
        module: ReturnModuleType.sales,
        repository: ReturnsRepository(apiClient: apiClient),
      )..loadInvoices(),
      child: const ReturnsScreenBody(module: ReturnModuleType.sales),
    );
  }
}
