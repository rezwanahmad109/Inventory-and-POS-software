import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_client.dart';

class OfflineStatusBanner extends StatefulWidget {
  const OfflineStatusBanner({
    required this.apiClient,
    required this.child,
    super.key,
  });

  final ApiClient apiClient;
  final Widget child;

  @override
  State<OfflineStatusBanner> createState() => _OfflineStatusBannerState();
}

class _OfflineStatusBannerState extends State<OfflineStatusBanner> {
  static const Duration _pollingInterval = Duration(seconds: 25);

  Timer? _timer;
  bool _isOffline = false;

  @override
  void initState() {
    super.initState();
    _probeConnection();
    _timer = Timer.periodic(_pollingInterval, (_) => _probeConnection());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _probeConnection() async {
    bool nextOffline = false;
    try {
      await widget.apiClient.get('health');
    } on ApiException catch (error) {
      // 4xx means backend is reachable but request is rejected.
      // 5xx/timeout/network errors are treated as offline/unhealthy.
      nextOffline = error.statusCode >= 500 || error.statusCode == 408;
    } catch (_) {
      nextOffline = true;
    }

    if (!mounted || _isOffline == nextOffline) {
      return;
    }

    setState(() {
      _isOffline = nextOffline;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        if (_isOffline)
          MaterialBanner(
            content: const Text(
              'Connection issue detected. You can continue browsing cached data.',
            ),
            leading: const Icon(Icons.wifi_off_outlined),
            actions: <Widget>[
              TextButton(
                onPressed: _probeConnection,
                child: const Text('Retry'),
              ),
            ],
          ),
        Expanded(child: widget.child),
      ],
    );
  }
}
