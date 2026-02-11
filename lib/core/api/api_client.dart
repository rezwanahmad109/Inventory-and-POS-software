import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../app_config.dart';

class ApiException implements Exception {
  const ApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiClient {
  ApiClient({this.token});

  String? token;
  final http.Client _client = http.Client();
  static const Duration _requestTimeout = Duration(seconds: 15);

  Uri _uri(String path, [Map<String, String>? queryParams]) {
    final base = AppConfig.apiBaseUri;
    return base.replace(
      path: '${base.path}/$path'.replaceAll('//', '/'),
      queryParameters: queryParams,
    );
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    try {
      final response = await _client
          .get(_uri(path, query), headers: _headers)
          .timeout(_requestTimeout);
      return _handleResponse(response);
    } on TimeoutException {
      throw const ApiException(408, 'Request timed out.');
    } on http.ClientException catch (error) {
      throw ApiException(503, 'Network error: ${error.message}');
    }
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    try {
      final response = await _client
          .post(
            _uri(path),
            headers: _headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(_requestTimeout);
      return _handleResponse(response);
    } on TimeoutException {
      throw const ApiException(408, 'Request timed out.');
    } on http.ClientException catch (error) {
      throw ApiException(503, 'Network error: ${error.message}');
    }
  }

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }
    String message = 'Request failed';
    try {
      final body = jsonDecode(response.body);
      message = body['message']?.toString() ?? message;
    } catch (_) {
      message = response.body;
    }
    throw ApiException(response.statusCode, message);
  }

  void dispose() {
    _client.close();
  }
}
