import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../app_config.dart';
import '../auth/token_storage_service.dart';

class ApiException implements Exception {
  const ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiClient {
  ApiClient({
    String? token,
    TokenStorageService? tokenStorage,
    http.Client? httpClient,
  })  : _tokenStorage = tokenStorage ?? const TokenStorageService(),
        _client = httpClient ?? http.Client(),
        _accessToken = token;

  final TokenStorageService _tokenStorage;
  final http.Client _client;
  static const Duration _requestTimeout = Duration(seconds: 15);

  String? _accessToken;
  String? _refreshToken;
  bool _initialized = false;
  Future<bool>? _refreshInFlight;

  String? get token => _accessToken;

  set token(String? value) {
    _accessToken = value;
    if (value == null) {
      unawaited(_tokenStorage.clearTokens());
      _refreshToken = null;
      return;
    }

    unawaited(_tokenStorage.writeAccessToken(value));
  }

  Uri _uri(String path, [Map<String, String>? queryParams]) {
    final Uri base = AppConfig.apiBaseUri;
    return base.replace(
      path: '${base.path}/$path'.replaceAll('//', '/'),
      queryParameters: queryParams,
    );
  }

  Map<String, String> get _headers => <String, String>{
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  Future<void> _ensureInitialized() async {
    if (_initialized) {
      return;
    }

    final AuthTokens tokens = await _tokenStorage.readTokens();
    _accessToken = tokens.accessToken;
    _refreshToken = tokens.refreshToken;
    _initialized = true;
  }

  Future<void> setSession({
    required String accessToken,
    required String refreshToken,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    await _tokenStorage.writeTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
  }

  Future<void> clearSession() async {
    _accessToken = null;
    _refreshToken = null;
    await _tokenStorage.clearTokens();
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    final http.Response response = await _requestWithAutoRefresh(
      path: path,
      request: () => _client
          .get(_uri(path, query), headers: _headers)
          .timeout(_requestTimeout),
    );
    return _handleResponse(response);
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    final http.Response response = await _requestWithAutoRefresh(
      path: path,
      request: () => _client
          .post(
            _uri(path),
            headers: _headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(_requestTimeout),
    );
    return _handleResponse(response);
  }

  Future<dynamic> put(String path, {Map<String, dynamic>? body}) async {
    final http.Response response = await _requestWithAutoRefresh(
      path: path,
      request: () => _client
          .put(
            _uri(path),
            headers: _headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(_requestTimeout),
    );
    return _handleResponse(response);
  }

  Future<http.Response> _requestWithAutoRefresh({
    required String path,
    required Future<http.Response> Function() request,
  }) async {
    await _ensureInitialized();

    try {
      http.Response response = await request();
      if (response.statusCode != 401 || !_canRefreshForPath(path)) {
        return response;
      }

      final bool refreshed = await _refreshAccessToken();
      if (!refreshed) {
        return response;
      }

      response = await request();
      return response;
    } on TimeoutException {
      throw const ApiException(408, 'Request timed out.');
    } on http.ClientException catch (error) {
      throw ApiException(503, 'Network error: ${error.message}');
    }
  }

  bool _canRefreshForPath(String path) {
    final String normalized = path.trim().toLowerCase();
    if (_refreshToken == null || _refreshToken!.trim().isEmpty) {
      return false;
    }

    return normalized != 'auth/login' &&
        normalized != 'auth/refresh' &&
        normalized != 'auth/revoke';
  }

  Future<bool> _refreshAccessToken() async {
    if (_refreshInFlight != null) {
      return _refreshInFlight!;
    }

    _refreshInFlight = _performRefreshRequest();
    try {
      return await _refreshInFlight!;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<bool> _performRefreshRequest() async {
    final String refreshToken = _refreshToken ?? '';
    if (refreshToken.isEmpty) {
      return false;
    }

    try {
      final http.Response response = await _client
          .post(
            _uri('auth/refresh'),
            headers: const <String, String>{'Content-Type': 'application/json'},
            body: jsonEncode(<String, dynamic>{'refreshToken': refreshToken}),
          )
          .timeout(_requestTimeout);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        await clearSession();
        return false;
      }

      if (response.body.isEmpty) {
        await clearSession();
        return false;
      }

      dynamic payload = jsonDecode(response.body);
      if (payload is Map<String, dynamic> && payload['data'] is Map<String, dynamic>) {
        payload = payload['data'];
      }
      if (payload is! Map<String, dynamic>) {
        await clearSession();
        return false;
      }

      final String? nextAccessToken = payload['accessToken']?.toString();
      final String? nextRefreshToken = payload['refreshToken']?.toString();
      if (nextAccessToken == null || nextRefreshToken == null) {
        await clearSession();
        return false;
      }

      await setSession(
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
      );
      return true;
    } catch (_) {
      await clearSession();
      return false;
    }
  }

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) {
        return null;
      }
      final dynamic body = jsonDecode(response.body);
      if (body is Map<String, dynamic> &&
          body.containsKey('statusCode') &&
          body.containsKey('data')) {
        return body['data'];
      }
      return body;
    }

    String message = 'Request failed';
    try {
      final dynamic body = jsonDecode(response.body);
      if (body is Map<String, dynamic>) {
        message = body['message']?.toString() ?? message;
        final dynamic errors = body['errors'];
        if (errors is List<dynamic> && errors.isNotEmpty) {
          message = errors.map((dynamic value) => value.toString()).join(', ');
        }
      }
    } catch (_) {
      message = response.body;
    }
    throw ApiException(response.statusCode, message);
  }

  void dispose() {
    _client.close();
  }
}
