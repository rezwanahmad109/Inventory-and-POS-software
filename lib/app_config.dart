import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Application-wide configuration values.
///
/// Use `--dart-define` to override defaults at build time, for example:
/// `--dart-define=API_BASE_URL=https://api.example.com`
class AppConfig {
  static const String _buildTimeAppEnv = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'dev',
  );

  /// Raw API base URL from build-time environment.
  static const String _buildTimeApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  static const String _buildTimeApiKey = String.fromEnvironment(
    'API_KEY',
    defaultValue: '',
  );

  static const String _buildTimeSentryDsn = String.fromEnvironment(
    'SENTRY_DSN',
    defaultValue: '',
  );

  static String get appEnvironment {
    final String? envValue = _readDotEnv('APP_ENV');
    final String resolved = (envValue ?? _buildTimeAppEnv).trim().toLowerCase();
    if (resolved == 'prod' || resolved == 'staging' || resolved == 'dev') {
      return resolved;
    }
    return 'dev';
  }

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

  /// Optional static secret/token configured at build/runtime.
  ///
  /// This is not used as a replacement for user auth tokens.
  static String get apiKey {
    final String? envValue = _readDotEnv('API_KEY');
    if (envValue != null && envValue.trim().isNotEmpty) {
      return envValue.trim();
    }
    return _buildTimeApiKey;
  }

  static String get sentryDsn {
    final String? envValue = _readDotEnv('SENTRY_DSN');
    if (envValue != null && envValue.trim().isNotEmpty) {
      return envValue.trim();
    }
    return _buildTimeSentryDsn;
  }
}

String? _readDotEnv(String key) {
  try {
    return dotenv.env[key];
  } catch (_) {
    return null;
  }
}
