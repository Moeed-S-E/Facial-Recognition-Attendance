import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class ExceptionScreen extends StatelessWidget {
  const ExceptionScreen({super.key, this.data});

  final Map<String, dynamic>? data;

  @override
  Widget build(BuildContext context) {
    final exceptionType =
        data?['exception_type']?.toString() ?? 'Attendance exception';
    final severity = data?['severity']?.toString() ?? 'medium';
    final status = data?['exception_status']?.toString() ?? 'open';
    final actionUrl = data?['action_url']?.toString();
    final severityColor = severity == 'high'
        ? AppPalette.amber
        : severity == 'low'
        ? AppPalette.mint
        : AppPalette.blue;

    return Scaffold(
      appBar: AppBar(title: const Text('Attendance exception')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(22),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: severityColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(22),
              ),
              child: Icon(
                Icons.warning_amber_rounded,
                color: severityColor,
                size: 30,
              ),
            ),
            const SizedBox(height: 22),
            Text(
              _labelFor(exceptionType),
              style: const TextStyle(
                color: AppPalette.ink,
                fontSize: 25,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Status: ${_labelFor(status)}',
              style: TextStyle(
                color: severityColor,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'This attendance event needs workspace review. Biometric data is not displayed on the mobile device.',
              style: TextStyle(
                color: AppPalette.muted,
                fontSize: 15,
                height: 1.5,
              ),
            ),
            if (actionUrl != null) ...[
              const SizedBox(height: 18),
              Text(
                'Web inbox link: $actionUrl',
                style: const TextStyle(
                  color: AppPalette.muted,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _labelFor(String value) => value
      .replaceAll('_', ' ')
      .split(' ')
      .map(
        (word) => word.isEmpty
            ? word
            : '${word[0].toUpperCase()}${word.substring(1)}',
      )
      .join(' ');
}
