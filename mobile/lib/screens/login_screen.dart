import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/attendance_provider.dart';
import '../theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _showPassword = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _errorMessage = null);
    final authProvider = context.read<AuthProvider>();
    try {
      final success = await authProvider.login(
        _emailController.text.trim(),
        _passwordController.text,
      );

      if (success && mounted) {
        final payload = authProvider.userPayload ?? const <String, dynamic>{};
        context.read<AttendanceProvider>().setAuthenticatedAccount(
              id: (payload['id'] ?? payload['user_id'] ?? payload['sub'] ?? '').toString(),
              name: (payload['name'] ?? payload['full_name'] ?? _emailController.text.trim()).toString(),
              email: (payload['email'] ?? payload['sub'] ?? _emailController.text.trim()).toString(),
              role: (payload['role'] ?? 'employee').toString(),
              authToken: authProvider.token,
            );
        Navigator.of(context).pushReplacementNamed('/main');
      }
    } catch (e) {
      if (!mounted) return;
      final detail = e.toString();
      setState(() {
        _errorMessage = detail.contains('SocketException') ||
                detail.contains('Failed host lookup') ||
                detail.contains('ClientException')
            ? 'Unable to reach the attendance server. Check your connection and try again.'
            : detail.contains('Invalid credentials')
                ? 'Invalid email or password.'
                : 'Sign in failed. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = context.watch<AuthProvider>().isLoading;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
          child: Center(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 430),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _BrandMark(),
                      const SizedBox(height: 32),
                      TweenAnimationBuilder<double>(
                        duration: const Duration(milliseconds: 520),
                        curve: Curves.easeOutCubic,
                        tween: Tween(begin: 0.0, end: 1.0),
                        builder: (context, value, child) => Opacity(
                          opacity: value,
                          child: Transform.translate(
                            offset: Offset(0, 14 * (1 - value)),
                            child: child,
                          ),
                        ),
                        child: const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Welcome back.',
                              style: TextStyle(
                                color: AppPalette.ink,
                                fontSize: 34,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -1.2,
                              ),
                            ),
                            SizedBox(height: 8),
                            Text(
                              'Sign in to keep your team moving with confidence.',
                              style: TextStyle(
                                color: AppPalette.muted,
                                fontSize: 15,
                                height: 1.45,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      if (_errorMessage != null) ...[
                        _LoginError(message: _errorMessage!),
                        const SizedBox(height: 16),
                      ],
                      _FieldLabel('Work email'),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.username, AutofillHints.email],
                        decoration: const InputDecoration(
                          hintText: 'you@company.com',
                          prefixIcon: Icon(Icons.mail_outline_rounded),
                        ),
                        validator: (value) {
                          final email = value?.trim() ?? '';
                          if (email.isEmpty) return 'Enter your work email';
                          if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
                            return 'Enter a valid email address';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 18),
                      _FieldLabel('Password'),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: !_showPassword,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.password],
                        onFieldSubmitted: (_) => isLoading ? null : _login(),
                        decoration: InputDecoration(
                          hintText: 'Enter your password',
                          prefixIcon: const Icon(Icons.lock_outline_rounded),
                          suffixIcon: IconButton(
                            tooltip: _showPassword ? 'Hide password' : 'Show password',
                            onPressed: () => setState(() => _showPassword = !_showPassword),
                            icon: Icon(
                              _showPassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                            ),
                          ),
                        ),
                        validator: (value) =>
                            value == null || value.isEmpty ? 'Enter your password' : null,
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: isLoading ? null : _login,
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 180),
                          child: isLoading
                              ? const SizedBox(
                                  key: ValueKey('loading'),
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                  ),
                                )
                              : const Text('Sign in', key: ValueKey('label')),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const _SecurityNote(),
                      const SizedBox(height: 28),
                      const Divider(color: AppPalette.line),
                      const SizedBox(height: 20),
                      const Text(
                        'Need access?',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppPalette.ink,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 5),
                      const Text(
                        'Ask your organization owner or HR administrator to provision your account.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppPalette.muted,
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          height: 46,
          width: 46,
          decoration: BoxDecoration(
            color: AppPalette.ink,
            borderRadius: BorderRadius.circular(15),
            boxShadow: [
              BoxShadow(
                color: AppPalette.blue.withValues(alpha: 0.18),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(Icons.fingerprint_rounded, color: Colors.white, size: 25),
        ),
        const SizedBox(width: 12),
        const Text(
          'Facial Recognition Attendance',
          style: TextStyle(
            color: AppPalette.ink,
            fontSize: 16,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.2,
          ),
        ),
      ],
    );
  }
}

class _LoginError extends StatelessWidget {
  final String message;

  const _LoginError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppPalette.roseSoft,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppPalette.rose.withValues(alpha: 0.16)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline_rounded, color: AppPalette.rose, size: 19),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: AppPalette.ink,
                fontSize: 12,
                height: 1.35,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String label;

  const _FieldLabel(this.label);

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
        color: AppPalette.ink,
        fontSize: 13,
        fontWeight: FontWeight.w800,
      ),
    );
  }
}

class _SecurityNote extends StatelessWidget {
  const _SecurityNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppPalette.blueSoft,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppPalette.blue.withValues(alpha: 0.10)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.verified_user_outlined, color: AppPalette.blue, size: 19),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Your session is protected with encrypted authentication and role-based access.',
              style: TextStyle(
                color: AppPalette.ink,
                fontSize: 12,
                height: 1.4,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
