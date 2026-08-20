import 'package:flutter/material.dart';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';
import '../providers/attendance_provider.dart';
import '../providers/auth_provider.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _privacyExpanded = false;
  final _pinController = TextEditingController();
  final _pinConfirmController = TextEditingController();
  bool _pinLoading = false;
  String? _pinMessage;
  bool _showPin = false;

  @override
  void dispose() {
    _pinController.dispose();
    _pinConfirmController.dispose();
    super.dispose();
  }

  Future<void> _savePin() async {
    final pin = _pinController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(pin) ||
        pin != _pinConfirmController.text.trim()) {
      setState(
        () => _pinMessage = 'Use the same six-digit PIN in both fields.',
      );
      return;
    }
    final token = context.read<AuthProvider>().token;
    if (token == null) return;
    setState(() {
      _pinLoading = true;
      _pinMessage = null;
    });
    try {
      final response = await http.post(
        Uri.parse('${AuthProvider.baseUrl}/v1/attendance/pin'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'pin': pin}),
      );
      if (response.statusCode >= 300) {
        throw Exception(_pinDetail(response.body));
      }
      _pinController.clear();
      _pinConfirmController.clear();
      setState(() => _pinMessage = 'Attendance PIN saved securely.');
    } catch (error) {
      setState(
        () => _pinMessage = error.toString().replaceFirst('Exception: ', ''),
      );
    } finally {
      if (mounted) setState(() => _pinLoading = false);
    }
  }

  String _pinDetail(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic> && decoded['detail'] is String) {
        return decoded['detail'] as String;
      }
    } catch (_) {}
    return 'Could not save the attendance PIN.';
  }

  @override
  Widget build(BuildContext context) {
    final attendance = context.watch<AttendanceProvider>();
    final auth = context.watch<AuthProvider>();
    final account = attendance.currentAccount;
    final nameParts = account.name.trim().split(RegExp(r'\s+'));
    final initials = nameParts
        .take(2)
        .map((part) => part.isEmpty ? '' : part[0])
        .join()
        .toUpperCase();

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          children: [
            const PageTitle(eyebrow: "Account", title: "Profile"),
            const SizedBox(height: 24),
            FrostedCard(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  if (attendance.isLoading) ...[
                    const Skeleton(
                      width: 50,
                      height: 50,
                      shape: BoxShape.circle,
                    ),
                    const SizedBox(width: 15),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Skeleton(width: 120, height: 18),
                          SizedBox(height: 5),
                          Skeleton(width: 160, height: 14),
                          SizedBox(height: 5),
                          Skeleton(width: 140, height: 12),
                        ],
                      ),
                    ),
                  ] else ...[
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: AppPalette.ink,
                        borderRadius: BorderRadius.circular(25),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        initials.isEmpty ? '?' : initials,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 15),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            account.name,
                            style: TextStyle(
                              color: AppPalette.ink,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            account.role.label,
                            style: TextStyle(
                              color: AppPalette.muted,
                              fontSize: 13,
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            account.email,
                            style: TextStyle(
                              color: AppPalette.muted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 29),
            const Text(
              "Security & privacy",
              style: TextStyle(
                color: AppPalette.ink,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            FrostedCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppPalette.ink,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.security,
                          size: 21,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              "Biometric template",
                              style: TextStyle(
                                color: AppPalette.ink,
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              attendance.isFaceEnrolled
                                  ? "Enrolled and protected"
                                  : "Enrollment required before attendance",
                              style: const TextStyle(
                                color: AppPalette.muted,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      StatusPill(
                        label: attendance.isFaceEnrolled ? "Active" : "Setup",
                        tone: attendance.isFaceEnrolled ? "mint" : "amber",
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    "The app sends a temporary capture to the authenticated backend, which stores a protected face embedding for matching and removes the temporary photo after processing.",
                    style: TextStyle(
                      color: AppPalette.muted,
                      fontSize: 13,
                      height: 1.46,
                    ),
                  ),
                  const SizedBox(height: 14),
                  PrimaryButton(
                    label: attendance.isFaceEnrolled
                        ? "Retake enrollment photo"
                        : "Enroll attendance photo",
                    icon: Icons.face,
                    onPressed: () => Navigator.pushNamed(
                      context,
                      '/verify',
                      arguments: {'mode': 'enroll'},
                    ),
                  ),
                  const SizedBox(height: 14),
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _privacyExpanded = !_privacyExpanded;
                      });
                    },
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _privacyExpanded
                              ? "Show less"
                              : "How verification works",
                          style: const TextStyle(
                            color: AppPalette.blue,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Icon(
                          _privacyExpanded
                              ? Icons.keyboard_arrow_down
                              : Icons.chevron_right,
                          size: 17,
                          color: AppPalette.blue,
                        ),
                      ],
                    ),
                  ),
                  if (_privacyExpanded)
                    Container(
                      margin: const EdgeInsets.only(top: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppPalette.blueSoft,
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: const Text(
                        "A compliant implementation should validate face quality and liveness, compare a protected template using a configured threshold, then apply the attendance policy before creating a record.",
                        style: TextStyle(
                          color: Color(0xFF2452A2),
                          fontSize: 12,
                          height: 1.5,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            FrostedCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'PIN fallback',
                    style: TextStyle(
                      color: AppPalette.ink,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Set or replace the six-digit fallback used when camera verification is unavailable.',
                    style: TextStyle(
                      color: AppPalette.muted,
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _pinController,
                    keyboardType: TextInputType.number,
                    obscureText: !_showPin,
                    maxLength: 6,
                    decoration: InputDecoration(
                      labelText: 'New six-digit PIN',
                      counterText: '',
                      suffixIcon: IconButton(
                        icon: Icon(
                          _showPin
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 20,
                          color: AppPalette.muted,
                        ),
                        onPressed: () => setState(() => _showPin = !_showPin),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _pinConfirmController,
                    keyboardType: TextInputType.number,
                    obscureText: !_showPin,
                    maxLength: 6,
                    decoration: InputDecoration(
                      labelText: 'Repeat PIN',
                      counterText: '',
                      suffixIcon: IconButton(
                        icon: Icon(
                          _showPin
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 20,
                          color: AppPalette.muted,
                        ),
                        onPressed: () => setState(() => _showPin = !_showPin),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  PrimaryButton(
                    label: _pinLoading ? 'Saving…' : 'Save PIN',
                    icon: Icons.lock,
                    onPressed: _pinLoading ? () {} : _savePin,
                  ),
                  if (_pinMessage != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _pinMessage!,
                      style: const TextStyle(
                        color: AppPalette.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 29),
            const Text(
              "Preferences",
              style: TextStyle(
                color: AppPalette.ink,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            FrostedCard(
              padding: const EdgeInsets.symmetric(horizontal: 17),
              child: Column(
                children: [
                  Container(
                    constraints: const BoxConstraints(minHeight: 76),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: AppPalette.blueSoft,
                            borderRadius: BorderRadius.circular(13),
                          ),
                          child: const Icon(
                            Icons.notifications,
                            size: 18,
                            color: AppPalette.blue,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "Attendance updates",
                                style: TextStyle(
                                  color: AppPalette.ink,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                attendance.notificationsEnabled
                                    ? "Realtime updates are on this device."
                                    : "Realtime updates are paused on this device.",
                                style: const TextStyle(
                                  color: AppPalette.muted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Switch(
                          value: attendance.notificationsEnabled,
                          onChanged: attendance.setNotificationsEnabled,
                          activeTrackColor: const Color(0xFF8CB5FF),
                          inactiveTrackColor: const Color(0xFFD5D9E2),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1, color: AppPalette.line),
                  Container(
                    constraints: const BoxConstraints(minHeight: 68),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.volume_up_outlined,
                          size: 20,
                          color: AppPalette.blue,
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Text(
                            "Notification sound",
                            style: TextStyle(
                              color: AppPalette.ink,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Switch(
                          value: attendance.notificationSoundsEnabled,
                          onChanged: attendance.notificationsEnabled
                              ? attendance.setNotificationSoundsEnabled
                              : null,
                          activeTrackColor: const Color(0xFF8CB5FF),
                          inactiveTrackColor: const Color(0xFFD5D9E2),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1, color: AppPalette.line),
                  Container(
                    constraints: const BoxConstraints(minHeight: 68),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.history_outlined,
                          size: 20,
                          color: AppPalette.blue,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            attendance.notifications.isEmpty
                                ? 'No notification history on this device.'
                                : '${attendance.notifications.length} notification${attendance.notifications.length == 1 ? '' : 's'} saved on this device.',
                            style: const TextStyle(
                              color: AppPalette.ink,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (attendance.notifications.isNotEmpty)
                          TextButton(
                            onPressed: attendance.clearNotificationHistory,
                            child: const Text('Clear'),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await context
                      .read<AttendanceProvider>()
                      .clearAuthenticatedAccount();
                  await auth.logout();
                  if (context.mounted) {
                    Navigator.of(
                      context,
                    ).pushNamedAndRemoveUntil('/login', (route) => false);
                  }
                },
                icon: const Icon(Icons.logout),
                label: const Text('Sign out'),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
