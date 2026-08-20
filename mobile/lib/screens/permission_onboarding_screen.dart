import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';

import '../providers/attendance_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';

class PermissionOnboardingScreen extends StatefulWidget {
  final String nextRoute;

  const PermissionOnboardingScreen({super.key, required this.nextRoute});

  @override
  State<PermissionOnboardingScreen> createState() =>
      _PermissionOnboardingScreenState();
}

class _PermissionOnboardingScreenState
    extends State<PermissionOnboardingScreen> {
  static const _completionKey = 'permission_onboarding_complete';
  static const _storage = FlutterSecureStorage();

  bool _isRequesting = true;
  bool _cameraGranted = false;
  bool _notificationGranted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _requestPermissions());
  }

  Future<void> _requestPermissions() async {
    final attendance = context.read<AttendanceProvider>();
    var cameraGranted = false;

    try {
      final cameras = await availableCameras();
      if (cameras.isNotEmpty) {
        final frontCamera = cameras.firstWhere(
          (camera) => camera.lensDirection == CameraLensDirection.front,
          orElse: () => cameras.first,
        );
        final controller = CameraController(
          frontCamera,
          ResolutionPreset.low,
          enableAudio: false,
        );
        try {
          await controller.initialize();
          cameraGranted = controller.value.isInitialized;
        } finally {
          await controller.dispose();
        }
      }
    } catch (_) {
      cameraGranted = false;
    }

    final notificationGranted = await attendance
        .requestNotificationPermission();
    if (!mounted) return;
    setState(() {
      _cameraGranted = cameraGranted;
      _notificationGranted = notificationGranted;
      _isRequesting = false;
    });
  }

  Future<void> _continue() async {
    await _storage.write(key: _completionKey, value: 'true');
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(widget.nextRoute);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppPalette.canvas,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 36, 24, 24),
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppPalette.ink,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.security, color: Colors.white, size: 30),
            ),
            const SizedBox(height: 28),
            const Text(
              'Set up secure access',
              style: TextStyle(
                color: AppPalette.ink,
                fontSize: 30,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.8,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'We need camera access for facial attendance and notification access for realtime updates. You will only see these system prompts once during setup.',
              style: TextStyle(
                color: AppPalette.muted,
                fontSize: 15,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 28),
            FrostedCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: [
                  _PermissionRow(
                    icon: Icons.camera_alt_outlined,
                    title: 'Camera access',
                    detail:
                        'Required for enrollment and attendance verification.',
                    granted: _cameraGranted,
                    isLoading: _isRequesting,
                  ),
                  const Divider(height: 28, color: AppPalette.line),
                  _PermissionRow(
                    icon: Icons.notifications_none,
                    title: 'Notification access',
                    detail:
                        'Keeps attendance updates and review alerts visible.',
                    granted: _notificationGranted,
                    isLoading: _isRequesting,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            if (!_isRequesting && (!_cameraGranted || !_notificationGranted))
              const Text(
                'Some access is still off. You can enable it later in Android Settings if needed.',
                style: TextStyle(
                  color: AppPalette.muted,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            const SizedBox(height: 22),
            PrimaryButton(
              label: _isRequesting ? 'Requesting access…' : 'Continue',
              icon: _isRequesting ? Icons.hourglass_top : Icons.arrow_forward,
              onPressed: _isRequesting ? null : _continue,
            ),
          ],
        ),
      ),
    );
  }
}

class _PermissionRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String detail;
  final bool granted;
  final bool isLoading;

  const _PermissionRow({
    required this.icon,
    required this.title,
    required this.detail,
    required this.granted,
    required this.isLoading,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppPalette.blueSoft,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: AppPalette.blue, size: 21),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: AppPalette.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                detail,
                style: const TextStyle(
                  color: AppPalette.muted,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        if (isLoading)
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppPalette.blue,
            ),
          )
        else
          Icon(
            granted ? Icons.check_circle : Icons.error_outline,
            color: granted ? AppPalette.mint : AppPalette.amber,
            size: 21,
          ),
      ],
    );
  }
}
