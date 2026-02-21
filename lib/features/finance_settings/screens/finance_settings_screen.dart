import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/api/api_client.dart';
import '../../../core/ui/feedback_panel.dart';
import '../../../core/ui/offline_status_banner.dart';
import '../bloc/finance_settings_cubit.dart';
import '../bloc/finance_settings_state.dart';
import '../repository/finance_settings_repository.dart';

class FinanceSettingsScreen extends StatelessWidget {
  const FinanceSettingsScreen({
    required this.apiClient,
    this.initialTabIndex = 0,
    super.key,
  });

  final ApiClient apiClient;
  final int initialTabIndex;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<FinanceSettingsCubit>(
      create: (_) => FinanceSettingsCubit(
        repository: FinanceSettingsRepository(apiClient: apiClient),
      )..loadAll(),
      child: _FinanceSettingsView(
        apiClient: apiClient,
        initialTabIndex: initialTabIndex,
      ),
    );
  }
}

class _FinanceSettingsView extends StatelessWidget {
  const _FinanceSettingsView({
    required this.apiClient,
    required this.initialTabIndex,
  });

  final ApiClient apiClient;
  final int initialTabIndex;

  @override
  Widget build(BuildContext context) {
    final int safeInitialTabIndex = initialTabIndex < 0
        ? 0
        : (initialTabIndex > 2 ? 2 : initialTabIndex);
    return DefaultTabController(
      length: 3,
      initialIndex: safeInitialTabIndex,
      child: BlocConsumer<FinanceSettingsCubit, FinanceSettingsState>(
        listener: (BuildContext context, FinanceSettingsState state) {
          if (state.errorMessage != null && state.errorMessage!.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(_cleanError(state.errorMessage!))),
            );
            context.read<FinanceSettingsCubit>().clearFeedback();
          }
          if (state.successMessage != null &&
              state.successMessage!.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.successMessage!),
                backgroundColor: Colors.green.shade700,
              ),
            );
            context.read<FinanceSettingsCubit>().clearFeedback();
          }
        },
        builder: (BuildContext context, FinanceSettingsState state) {
          return Scaffold(
            appBar: AppBar(
              title: const Text('Finance Settings & Access'),
              bottom: const TabBar(
                isScrollable: true,
                tabs: <Tab>[
                  Tab(text: 'Chart of Accounts'),
                  Tab(text: 'Posting & Period'),
                  Tab(text: 'Users & Permissions'),
                ],
              ),
              actions: <Widget>[
                IconButton(
                  onPressed: state.isLoading
                      ? null
                      : () => context.read<FinanceSettingsCubit>().loadAll(),
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
                        _AccountsTab(),
                        _PostingAndPeriodTab(),
                        _UsersPermissionsTab(),
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

class _AccountsTab extends StatefulWidget {
  const _AccountsTab();

  @override
  State<_AccountsTab> createState() => _AccountsTabState();
}

class _AccountsTabState extends State<_AccountsTab> {
  final TextEditingController _codeController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _subTypeController = TextEditingController();
  String _accountType = 'asset';

  @override
  void dispose() {
    _codeController.dispose();
    _nameController.dispose();
    _subTypeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<FinanceSettingsCubit, FinanceSettingsState>(
      builder: (BuildContext context, FinanceSettingsState state) {
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
                      'Chart of Accounts',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: state.isSubmitting
                                ? null
                                : () => context
                                      .read<FinanceSettingsCubit>()
                                      .seedDefaultAccounts(),
                            icon: const Icon(Icons.auto_fix_high_outlined),
                            label: const Text('Seed Default'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: state.isSubmitting
                                ? null
                                : () => context
                                      .read<FinanceSettingsCubit>()
                                      .createAccount(
                                        code: _codeController.text,
                                        name: _nameController.text,
                                        accountType: _accountType,
                                        subType: _subTypeController.text,
                                      ),
                            icon: const Icon(Icons.add),
                            label: const Text('Create Account'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _codeController,
                      decoration: const InputDecoration(labelText: 'Code'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _nameController,
                      decoration: const InputDecoration(labelText: 'Name'),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _accountType,
                      decoration: const InputDecoration(
                        labelText: 'Account type',
                      ),
                      items: const <DropdownMenuItem<String>>[
                        DropdownMenuItem<String>(
                          value: 'asset',
                          child: Text('Asset'),
                        ),
                        DropdownMenuItem<String>(
                          value: 'liability',
                          child: Text('Liability'),
                        ),
                        DropdownMenuItem<String>(
                          value: 'equity',
                          child: Text('Equity'),
                        ),
                        DropdownMenuItem<String>(
                          value: 'revenue',
                          child: Text('Revenue'),
                        ),
                        DropdownMenuItem<String>(
                          value: 'expense',
                          child: Text('Expense'),
                        ),
                      ],
                      onChanged: (String? value) {
                        setState(() {
                          _accountType = value ?? 'asset';
                        });
                      },
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _subTypeController,
                      decoration: const InputDecoration(
                        labelText: 'Subtype (optional)',
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
                      'Accounts',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    if (state.accounts.isEmpty)
                      const FeedbackPanel(message: 'No accounts available.')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.accounts.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final FinanceAccountModel row = state.accounts[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text('${row.code} - ${row.name}'),
                            subtitle: Text(
                              '${row.accountType} | ${row.currency}',
                            ),
                            trailing: Text(
                              row.isActive ? 'Active' : 'Inactive',
                            ),
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

class _PostingAndPeriodTab extends StatefulWidget {
  const _PostingAndPeriodTab();

  @override
  State<_PostingAndPeriodTab> createState() => _PostingAndPeriodTabState();
}

class _PostingAndPeriodTabState extends State<_PostingAndPeriodTab> {
  final TextEditingController _lockReasonController = TextEditingController();
  DateTimeRange? _periodRange;

  @override
  void dispose() {
    _lockReasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<FinanceSettingsCubit, FinanceSettingsState>(
      builder: (BuildContext context, FinanceSettingsState state) {
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
                      'Posting Mapping',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    ...state.postingMappings.entries.map(
                      (MapEntry<String, String> row) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: TextFormField(
                          initialValue: row.value,
                          decoration: InputDecoration(labelText: row.key),
                          onChanged: (String value) => context
                              .read<FinanceSettingsCubit>()
                              .updatePostingMapping(row.key, value),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => context
                            .read<FinanceSettingsCubit>()
                            .savePostingMappingsSessionOnly(),
                        icon: const Icon(Icons.save_outlined),
                        label: const Text('Save Draft Mapping'),
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
                      'Period Closing',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final DateTime now = DateTime.now();
                        final DateTimeRange? picked = await showDateRangePicker(
                          context: context,
                          firstDate: DateTime(now.year - 2),
                          lastDate: DateTime(now.year + 1),
                          initialDateRange: _periodRange,
                        );
                        if (picked == null) return;
                        setState(() {
                          _periodRange = picked;
                        });
                      },
                      icon: const Icon(Icons.date_range_outlined),
                      label: Text(
                        _periodRange == null
                            ? 'Select period'
                            : '${_dateLabel(_periodRange!.start)} to ${_dateLabel(_periodRange!.end)}',
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _lockReasonController,
                      decoration: const InputDecoration(labelText: 'Reason'),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _periodRange == null
                            ? null
                            : () => context
                                  .read<FinanceSettingsCubit>()
                                  .lockPeriod(
                                    startDate: _periodRange!.start,
                                    endDate: _periodRange!.end,
                                    reason: _lockReasonController.text,
                                  ),
                        child: const Text('Lock Period'),
                      ),
                    ),
                    const Divider(height: 16),
                    if (state.periodLocks.isEmpty)
                      const FeedbackPanel(message: 'No period locks found.')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.periodLocks.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final PeriodLockModel row = state.periodLocks[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              '${_dateLabel(row.startDate)} to ${_dateLabel(row.endDate)}',
                            ),
                            subtitle: Text(row.reason ?? '-'),
                            trailing: row.isLocked
                                ? OutlinedButton(
                                    onPressed: () => context
                                        .read<FinanceSettingsCubit>()
                                        .unlockPeriod(row.id),
                                    child: const Text('Unlock'),
                                  )
                                : const Text('Unlocked'),
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

class _UsersPermissionsTab extends StatefulWidget {
  const _UsersPermissionsTab();

  @override
  State<_UsersPermissionsTab> createState() => _UsersPermissionsTabState();
}

class _UsersPermissionsTabState extends State<_UsersPermissionsTab> {
  final TextEditingController _userNameController = TextEditingController();
  final TextEditingController _userEmailController = TextEditingController();
  final TextEditingController _userPasswordController = TextEditingController();
  final TextEditingController _permissionModuleController =
      TextEditingController();
  final TextEditingController _permissionActionController =
      TextEditingController();
  final TextEditingController _permissionDescriptionController =
      TextEditingController();

  String? _newUserRoleId;

  @override
  void dispose() {
    _userNameController.dispose();
    _userEmailController.dispose();
    _userPasswordController.dispose();
    _permissionModuleController.dispose();
    _permissionActionController.dispose();
    _permissionDescriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<FinanceSettingsCubit, FinanceSettingsState>(
      builder: (BuildContext context, FinanceSettingsState state) {
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
                      'Create User',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _userNameController,
                      decoration: const InputDecoration(labelText: 'Name'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _userEmailController,
                      decoration: const InputDecoration(labelText: 'Email'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _userPasswordController,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Password'),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _newUserRoleId,
                      decoration: const InputDecoration(labelText: 'Role'),
                      items: state.roles
                          .map(
                            (RoleOption row) => DropdownMenuItem<String>(
                              value: row.id,
                              child: Text(row.name),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (String? value) => setState(() {
                        _newUserRoleId = value;
                      }),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: state.isSubmitting
                            ? null
                            : () => context
                                  .read<FinanceSettingsCubit>()
                                  .createUser(
                                    name: _userNameController.text,
                                    email: _userEmailController.text,
                                    password: _userPasswordController.text,
                                    roleId: _newUserRoleId ?? '',
                                  ),
                        icon: const Icon(Icons.person_add_alt_1_outlined),
                        label: const Text('Create User'),
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
                      'Users',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    if (state.users.isEmpty)
                      const FeedbackPanel(message: 'No users found.')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.users.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final ManagedUserModel row = state.users[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text(row.name),
                            subtitle: Text(
                              '${row.email} | ${row.status} | ${row.roles.join(', ')}',
                            ),
                          );
                        },
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
                      'Permission CRUD',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _permissionModuleController,
                      decoration: const InputDecoration(labelText: 'Module'),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _permissionActionController,
                      decoration: const InputDecoration(
                        labelText: 'Action or slug',
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _permissionDescriptionController,
                      decoration: const InputDecoration(
                        labelText: 'Description',
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: state.isSubmitting
                            ? null
                            : () => context
                                  .read<FinanceSettingsCubit>()
                                  .createPermission(
                                    module: _permissionModuleController.text,
                                    action: _permissionActionController.text,
                                    description:
                                        _permissionDescriptionController.text,
                                  ),
                        icon: const Icon(Icons.add_moderator_outlined),
                        label: const Text('Create Permission'),
                      ),
                    ),
                    const Divider(height: 14),
                    if (state.permissions.isEmpty)
                      const FeedbackPanel(message: 'No permissions found.')
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: state.permissions.length,
                        separatorBuilder: (_, __) => const Divider(height: 8),
                        itemBuilder: (BuildContext context, int index) {
                          final PermissionModel row = state.permissions[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text(row.slug),
                            subtitle: Text(row.description ?? '-'),
                            trailing: IconButton(
                              onPressed: () => context
                                  .read<FinanceSettingsCubit>()
                                  .deletePermission(row.id),
                              icon: const Icon(Icons.delete_outline),
                            ),
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

String _dateLabel(DateTime? value) {
  if (value == null) {
    return '-';
  }
  final DateTime local = value.toLocal();
  final String month = local.month.toString().padLeft(2, '0');
  final String day = local.day.toString().padLeft(2, '0');
  return '${local.year}-$month-$day';
}
