import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class MobileAccessDeniedScreen extends StatelessWidget {
  const MobileAccessDeniedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppPalette.canvas,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppPalette.rose.withValues(alpha: 0.16),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.admin_panel_settings_outlined, color: AppPalette.rose, size: 34),
                ),
                const SizedBox(height: 22),
                Text(
                  'Organization access only',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppPalette.ink,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  'This mobile app is available to organization owners, HR, managers, and employees. Sign in with an organization account to continue.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        height: 1.5,
                        color: AppPalette.muted,
                      ),
                ),
                const SizedBox(height: 24),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: AppPalette.line),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.open_in_new_rounded, color: AppPalette.blue),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Use an organization account with the appropriate role to access attendance tools on mobile.',
                          style: TextStyle(color: AppPalette.ink, height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
