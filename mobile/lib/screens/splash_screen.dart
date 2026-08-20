import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/attendance_provider.dart';
import '../theme/app_theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  static const _storage = FlutterSecureStorage();
  static const _permissionCompletionKey = 'permission_onboarding_complete';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final auth = context.read<AuthProvider>();
    await auth.checkAuthStatus();
    if (!mounted) return;
    if (auth.isAuthenticated) {
      final payload = auth.userPayload ?? const <String, dynamic>{};
      context.read<AttendanceProvider>().setAuthenticatedAccount(
        id: (payload['id'] ?? payload['user_id'] ?? payload['sub'] ?? '')
            .toString(),
        name:
            (payload['name'] ??
                    payload['full_name'] ??
                    payload['sub'] ??
                    'Employee')
                .toString(),
        email: (payload['email'] ?? payload['sub'] ?? '').toString(),
        role: (payload['role'] ?? 'employee').toString(),
        authToken: auth.token,
      );
    }
    final permissionSetupComplete =
        await _storage.read(key: _permissionCompletionKey) == 'true';
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(
      permissionSetupComplete
          ? (auth.isAuthenticated ? '/main' : '/login')
          : '/permissions',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppPalette.ink,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.security, size: 64, color: Colors.white),
            ),
            const SizedBox(height: 24),
            const Text(
              'Facial Recognition Attendance',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppPalette.ink,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
