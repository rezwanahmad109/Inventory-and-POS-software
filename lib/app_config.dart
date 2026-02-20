import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Application-wide configuration values.
///
/// Use `--dart-define` to override defaults at build time, for example:
/// `--dart-define=API_BASE_URL=https://api.example.com`
class AppConfig {
  /// Raw API base URL from build-time environment.
  static const String _buildTimeApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  static String get apiBaseUrl {
    final String? envValue = _readDotEnv('API_BASE_URL');
    if (envValue != null && envValue.trim().isNotEmpty) {
      return envValue.trim();
    }
    return _buildTimeApiBaseUrl;
  }

  /// Normalized and validated API base URI.
  ///
  /// Security rule:
  /// - `http` is allowed only for local development hosts.
  /// - non-local hosts must use `https`.
  static Uri get apiBaseUri {
    final Uri uri = Uri.parse(apiBaseUrl);

    final bool isLocal =
        uri.host == 'localhost' ||
        uri.host == '127.0.0.1' ||
        uri.host == '10.0.2.2' ||
        uri.host == '::1';

    final bool isHttp = uri.scheme == 'http';
    final bool isHttps = uri.scheme == 'https';

    if (!isHttp && !isHttps) {
      throw ArgumentError(
        'API_BASE_URL must use http or https. Received: ${uri.scheme}',
      );
    }

    if (!uri.hasAuthority || uri.host.isEmpty) {
      throw ArgumentError(
        'API_BASE_URL must include a valid host. Received: $apiBaseUrl',
      );
    }

    if (uri.userInfo.isNotEmpty) {
      throw ArgumentError(
        'API_BASE_URL must not include credentials in the URL.',
      );
    }

    if (isHttp && !isLocal) {
      throw ArgumentError(
        'Insecure API_BASE_URL is not allowed for non-local hosts: $apiBaseUrl',
      );
    }

    return uri;
  }
}

String? _readDotEnv(String key) {
  try {
    return dotenv.env[key];
  } catch (_) {
    return null;
  }
}
