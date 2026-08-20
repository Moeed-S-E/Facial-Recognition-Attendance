import 'package:flutter/material.dart';
import 'dart:convert';

import 'package:camera/camera.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:provider/provider.dart';

import '../providers/attendance_provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';

class VerifyScreen extends StatefulWidget {
  final String mode;
  const VerifyScreen({super.key, required this.mode});

  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen> with SingleTickerProviderStateMixin {
  String _phase = 'consent'; // consent, camera, checking, success, failed
  bool _hasConsent = false;
  CameraController? _cameraController;
  late AnimationController _successController;
  late Animation<double> _successAnimation;
  String? _errorMessage;
  final _pinController = TextEditingController();
  bool _pinLoading = false;
  bool _showPin = false;

  @override
  void initState() {
    super.initState();
    _successController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
    _successAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _successController, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _pinController.dispose();
    _successController.dispose();
    super.dispose();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      final frontCamera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      _cameraController = CameraController(
        frontCamera,
        ResolutionPreset.high,
        enableAudio: false,
      );
      await _cameraController!.initialize();
      setState(() {
        _phase = 'camera';
      });
    } catch (e) {
      setState(() {
        _phase = 'failed';
      });
    }
  }

  void _openCamera() {
    if (!_hasConsent) return;
    _initCamera();
  }

  Future<void> _captureAndVerify() async {
    if (context.read<AttendanceProvider>().todayComplete) {
      if (mounted) setState(() => _errorMessage = 'Attendance is already recorded for today.');
      return;
    }
    if (_cameraController == null || !_cameraController!.value.isInitialized) return;

    setState(() {
      _phase = 'checking';
      _errorMessage = null;
    });

    try {
      final auth = context.read<AuthProvider>();
      final token = auth.token;
      if (token == null || !auth.isAuthenticated) {
        throw Exception('Your session has expired. Sign in again and retry.');
      }

      final file = await _cameraController!.takePicture();
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${AuthProvider.baseUrl}/v1/attendance/${widget.mode == 'enroll' ? 'face/enroll' : 'verify'}'),
      )
        ..headers['Authorization'] = 'Bearer $token'
        ..files.add(
          await http.MultipartFile.fromPath(
            'capture',
            file.path,
            contentType: MediaType('image', 'jpeg'),
          ),
        );
      if (widget.mode != 'enroll') request.fields['action'] = widget.mode;

      final response = await http.Response.fromStream(await request.send());
      if (!mounted) return;

      if (response.statusCode != 200) {
        final detail = _responseDetail(response.body);
        if (widget.mode != 'enroll' && response.statusCode == 409 && _isEnrollmentConflict(detail)) {
          Navigator.of(context).pushReplacementNamed('/verify', arguments: {'mode': 'enroll'});
          return;
        }
        throw Exception(detail);
      }

      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      if (widget.mode != 'enroll') {
        context.read<AttendanceProvider>().applyVerifiedAttendance(payload);
      } else {
        context.read<AttendanceProvider>().isFaceEnrolled = true;
        await context.read<AttendanceProvider>().loadAttendance(token);
      }
      setState(() {
        _phase = 'success';
      });
      _successController.forward();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _phase = 'failed';
        _errorMessage = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _verifyWithPin() async {
    if (context.read<AttendanceProvider>().todayComplete) {
      if (mounted) setState(() => _errorMessage = 'Attendance is already recorded for today.');
      return;
    }
    final pin = _pinController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(pin)) {
      setState(() => _errorMessage = 'Enter your six-digit attendance PIN.');
      return;
    }
    setState(() => _pinLoading = true);
    try {
      final auth = context.read<AuthProvider>();
      final token = auth.token;
      if (token == null || !auth.isAuthenticated) throw Exception('Your session has expired. Sign in again and retry.');
      final response = await http.post(
        Uri.parse('${AuthProvider.baseUrl}/v1/attendance/pin/verify'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'action': widget.mode, 'pin': pin}),
      );
      if (!mounted) return;
      if (response.statusCode != 200) throw Exception(_responseDetail(response.body));
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      context.read<AttendanceProvider>().applyVerifiedAttendance(payload);
      setState(() {
        _phase = 'success';
        _errorMessage = null;
        _pinController.clear();
      });
      _successController.forward();
    } catch (error) {
      if (mounted) setState(() => _errorMessage = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _pinLoading = false);
    }
  }

  bool _isEnrollmentConflict(String detail) {
    final normalized = detail.toLowerCase();
    return normalized.contains('enrollment') || normalized.contains('enrolled') || normalized.contains('face profile');
  }

  String _responseDetail(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic> && decoded['detail'] is String) {
        return decoded['detail'] as String;
      }
    } catch (_) {
      // Use a generic message for malformed upstream responses.
    }
    return 'Attendance verification failed. Try again.';
  }

  @override
  Widget build(BuildContext context) {
    final attendance = context.watch<AttendanceProvider>();
    final heading = widget.mode == 'enroll' ? 'Enroll face' : widget.mode == 'check-in' ? 'Check in' : 'Check out';
    final isCameraVisible = _phase == 'camera' || _phase == 'checking';

    if (widget.mode != 'enroll' && attendance.todayComplete) {
      return Scaffold(
        backgroundColor: const Color(0xFFF4F8FF),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: FrostedCard(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.check_circle, color: AppPalette.mint, size: 52),
                    const SizedBox(height: 18),
                    const Text('Attendance is already complete', textAlign: TextAlign.center, style: TextStyle(color: AppPalette.ink, fontSize: 22, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    const Text('Your check-in and check-out are both recorded for today. Return tomorrow for the next attendance cycle.', textAlign: TextAlign.center, style: TextStyle(color: AppPalette.muted, fontSize: 14, height: 1.45)),
                    const SizedBox(height: 20),
                    PrimaryButton(label: 'Back to workspace', icon: Icons.arrow_forward, onPressed: () => Navigator.pop(context)),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF4F8FF),
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      AppIconButton(
                        icon: Icons.close,
                        onPressed: () => Navigator.pop(context),
                      ),
                      Text(
                        heading,
                        style: const TextStyle(
                          color: AppPalette.ink,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 44),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      if (isCameraVisible)
                        Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppPalette.blue.withValues(alpha: 0.2)),
                            borderRadius: BorderRadius.circular(32),
                            boxShadow: [
                              BoxShadow(
                                color: AppPalette.ink.withValues(alpha: 0.14),
                                offset: const Offset(0, 12),
                                blurRadius: 22,
                              ),
                            ],
                          ),
                          child: AspectRatio(
                            aspectRatio: 3 / 4,
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(32),
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                if (_cameraController != null && _cameraController!.value.isInitialized)
                                  CameraPreview(_cameraController!)
                                else
                                  Container(color: Colors.black),
                                Container(color: const Color(0xFF061022).withValues(alpha: 0.14)),
                                Center(
                                  child: Container(
                                    width: 154,
                                    height: 186,
                                    decoration: BoxDecoration(
                                      border: Border.all(
                                        color: Colors.white.withValues(alpha: 0.68),
                                        width: 1.5,
                                      ),
                                      borderRadius: BorderRadius.circular(100),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  bottom: 16,
                                  left: 0,
                                  right: 0,
                                  child: Center(
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF101828).withValues(alpha: 0.64),
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: const [
                                          Icon(Icons.lock, size: 14, color: Colors.white),
                                          SizedBox(width: 6),
                                          Text(
                                            "One-time local capture",
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        )
                      else
                        Container(
                          height: 220,
                          margin: const EdgeInsets.only(bottom: 16),
                          alignment: Alignment.center,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Container(
                                width: 248,
                                height: 248,
                                decoration: BoxDecoration(
                                  color: AppPalette.blue.withValues(alpha: 0.07),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              Container(
                                width: 202,
                                height: 202,
                                decoration: BoxDecoration(
                                  border: Border.all(
                                    color: AppPalette.blue.withValues(alpha: 0.16),
                                  ),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              Container(
                                width: 164,
                                height: 164,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.8),
                                  border: Border.all(
                                    color: AppPalette.blue.withValues(alpha: 0.16),
                                  ),
                                  shape: BoxShape.circle,
                                ),
                                alignment: Alignment.center,
                                child: Icon(
                                  _phase == 'success' ? Icons.check_circle : Icons.camera_alt,
                                  size: 76,
                                  color: _phase == 'success' ? AppPalette.mint : AppPalette.blue,
                                ),
                              ),
                              Positioned(
                                bottom: 0,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.86),
                                    border: Border.all(color: AppPalette.mint.withValues(alpha: 0.12)),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: const [
                                      Icon(Icons.lock, size: 14, color: AppPalette.mint),
                                      SizedBox(width: 6),
                                      Text(
                                        "Secure backend verification",
                                        style: TextStyle(
                                          color: AppPalette.mint,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      Column(
                        children: [
                          StatusPill(
                            label: _phase == 'success'
                                        ? 'Recorded'
                                : _phase == 'checking'
                                    ? 'Verifying securely'
                                    : _phase == 'failed'
                                        ? 'Verification failed'
                                        : 'Consent required',
                            tone: _phase == 'success'
                                ? 'mint'
                                : _phase == 'failed'
                                    ? 'rose'
                                    : 'blue',
                          ),
                          Padding(
                            padding: const EdgeInsets.only(top: 12, bottom: 8),
                            child: Text(
                              _phase == 'success'
                                  ? widget.mode == 'enroll' ? 'Face enrolled' : '$heading recorded'
                                      : _phase == 'failed'
                                      ? 'Let’s try that again'
                                      : heading,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: AppPalette.ink,
                                fontSize: 32,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.8,
                                height: 1.25,
                              ),
                            ),
                          ),
                          Text(
                              _phase == 'consent'
                                ? "Choose whether to use one encrypted camera capture for this attendance event."
                                : _phase == 'camera'
                                    ? "Center your enrolled face inside the guide, then take one photo."
                                    : _phase == 'checking'
                                        ? "The backend is comparing this capture with your enrolled face."
                                        : _phase == 'success'
                                            ? widget.mode == 'enroll' ? 'Your attendance profile is ready. You can now check in and out securely.' : "Your ${widget.mode == 'check-in' ? 'arrival' : 'departure'} was verified and saved to attendance history."
                                            : (_errorMessage ?? "Allow camera access to take a one-time attendance photo after consent."),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: AppPalette.muted,
                              fontSize: 15,
                              height: 1.46,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      if (_phase == 'consent') ...[
                        FrostedCard(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 42,
                                    height: 42,
                                    decoration: BoxDecoration(
                                      color: AppPalette.blueSoft,
                                      borderRadius: BorderRadius.circular(13),
                                    ),
                                    child: const Icon(Icons.shield, size: 19, color: AppPalette.blue),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: const [
                                        Text(
                                          "Your control, before the camera opens",
                                          style: TextStyle(
                                            color: AppPalette.ink,
                                            fontSize: 15,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        SizedBox(height: 3),
                                        Text(
                                          "After enrollment, one JPEG capture is sent over HTTPS for FaceNet comparison with your organization-scoped face template. The temporary image is deleted after processing.",
                                          style: TextStyle(
                                            color: AppPalette.muted,
                                            fontSize: 13,
                                            height: 1.38,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              GestureDetector(
                                onTap: () {
                                  setState(() {
                                    _hasConsent = !_hasConsent;
                                  });
                                },
                                child: Container(
                                  margin: const EdgeInsets.only(top: 16),
                                  padding: const EdgeInsets.only(top: 15),
                                  decoration: const BoxDecoration(
                                    border: Border(top: BorderSide(color: AppPalette.line)),
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 20,
                                        height: 20,
                                        margin: const EdgeInsets.only(top: 1, right: 10),
                                        decoration: BoxDecoration(
                                          color: _hasConsent ? AppPalette.blue : Colors.transparent,
                                          border: Border.all(
                                            color: _hasConsent ? AppPalette.blue : const Color(0xFFB8C0CE),
                                            width: 1.5,
                                          ),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        alignment: Alignment.center,
                                        child: _hasConsent
                                            ? const Icon(Icons.check, size: 13, color: Colors.white)
                                            : null,
                                      ),
                                      const Expanded(
                                        child: Text(
                                          "I consent to this one-time camera capture and secure backend facial verification for this attendance event.",
                                          style: TextStyle(
                                            color: AppPalette.ink,
                                            fontSize: 13,
                                            height: 1.38,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 18),
                        PrimaryButton(
                          label: "Continue to camera",
                          icon: Icons.camera_alt,
                          onPressed: _hasConsent ? _openCamera : () {},
                        ),
                      ],
                      if (_phase == 'camera')
                        PrimaryButton(
                          label: "Capture attendance photo",
                          icon: Icons.camera_alt,
                          onPressed: _captureAndVerify,
                        ),
                      if (_phase == 'checking')
                        Container(
                          height: 54,
                          decoration: BoxDecoration(
                            color: AppPalette.ink,
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              ),
                              SizedBox(width: 10),
                              Text(
                                "Verifying with backend…",
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      if (_phase == 'failed') ...[
                        PrimaryButton(
                          label: "Try camera access again",
                          onPressed: _openCamera,
                        ),
                        if (widget.mode != 'enroll') ...[
                          const SizedBox(height: 14),
                          TextField(
                            controller: _pinController,
                            keyboardType: TextInputType.number,
                            obscureText: !_showPin,
                            maxLength: 6,
                            decoration: InputDecoration(
                              labelText: 'Six-digit attendance PIN',
                              counterText: '',
                              suffixIcon: IconButton(
                                icon: Icon(_showPin ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20, color: AppPalette.muted),
                                onPressed: () => setState(() => _showPin = !_showPin),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          PrimaryButton(
                            label: _pinLoading ? "Checking PIN…" : "Use PIN fallback",
                            icon: Icons.lock,
                            onPressed: _pinLoading ? () {} : _verifyWithPin,
                          ),
                        ],
                      ],
                    ],
                  ),
                ),
              ],
            ),
            if (_phase == 'success')
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: AnimatedBuilder(
                  animation: _successAnimation,
                  builder: (context, child) {
                    return Transform.translate(
                      offset: Offset(0, 28 * (1 - _successAnimation.value)),
                      child: Opacity(
                        opacity: _successAnimation.value,
                        child: child,
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.only(left: 24, right: 24, top: 24, bottom: 34),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.98),
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(30),
                        topRight: Radius.circular(30),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF101828).withValues(alpha: 0.12),
                          offset: const Offset(0, -8),
                          blurRadius: 26,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 36,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 20),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD5D9E2),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const Icon(Icons.check_circle, size: 44, color: AppPalette.mint),
                        const SizedBox(height: 10),
                        const Text(
                          "Attendance verified",
                          style: TextStyle(
                            color: AppPalette.ink,
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          "Your face matched the enrolled template. The temporary JPEG was deleted after secure backend processing.",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppPalette.muted,
                            fontSize: 14,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 20),
                        PrimaryButton(
                          label: "Done",
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
