import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:jwt_decoder/jwt_decoder.dart';

class AuthProvider extends ChangeNotifier {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  
  // Override with --dart-define=API_BASE_URL=https://api.example.com for release builds.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.ai-facial-attendance.app',
  );

  String? _token;
  Map<String, dynamic>? _userPayload;
  bool _isLoading = false;

  String? get token => _token;
  Map<String, dynamic>? get userPayload => _userPayload;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _token != null && !JwtDecoder.isExpired(_token!);

  Future<void> checkAuthStatus() async {
    final storedToken = await _storage.read(key: 'jwt_token');
    if (storedToken != null && !JwtDecoder.isExpired(storedToken)) {
      _token = storedToken;
      _userPayload = JwtDecoder.decode(storedToken);
    } else {
      _token = null;
      _userPayload = null;
      await _storage.delete(key: 'jwt_token');
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _setLoading(true);
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/token'),
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: {'username': email, 'password': password},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final accessToken = data['access_token'];
        
        await _storage.write(key: 'jwt_token', value: accessToken);
        _token = accessToken;
        _userPayload = JwtDecoder.decode(accessToken);
        
        notifyListeners();
        return true;
      } else {
        throw Exception('Invalid credentials');
      }
    } finally {
      _setLoading(false);
    }
  }

  Future<void> updateToken(String newToken) async {
    await _storage.write(key: 'jwt_token', value: newToken);
    _token = newToken;
    _userPayload = JwtDecoder.decode(newToken);
    notifyListeners();
  }

  Future<bool> register(String organizationName, String name, String email, String password) async {
    _setLoading(true);
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/register'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'organization_name': organizationName,
          'name': name,
          'email': email,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        // Auto-login after successful registration
        return await login(email, password);
      } else {
        final error = json.decode(response.body);
        throw Exception(error['detail'] ?? 'Registration failed');
      }
    } finally {
      _setLoading(false);
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: 'jwt_token');
    _token = null;
    _userPayload = null;
    notifyListeners();
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }
}
