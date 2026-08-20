// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:mobile/main.dart';
import 'package:mobile/providers/attendance_provider.dart';
import 'package:mobile/providers/auth_provider.dart';
import 'package:mobile/screens/home_screen.dart';

void main() {
  test('notification preference can be changed', () {
    final attendance = AttendanceProvider();
    expect(attendance.notificationsEnabled, isTrue);
    attendance.setNotificationsEnabled(false);
    expect(attendance.notificationsEnabled, isFalse);
    attendance.setNotificationsEnabled(true);
    expect(attendance.notificationsEnabled, isTrue);
    attendance.dispose();
  });

  test('notification sound preference can be changed independently', () {
    final attendance = AttendanceProvider();
    expect(attendance.notificationSoundsEnabled, isTrue);
    attendance.setNotificationSoundsEnabled(false);
    expect(attendance.notificationSoundsEnabled, isFalse);
    attendance.setNotificationSoundsEnabled(true);
    expect(attendance.notificationSoundsEnabled, isTrue);
    attendance.dispose();
  });

  test('notification history remains after being marked read', () {
    final attendance = AttendanceProvider();
    attendance.notifications.add(
      MobileNotification(
        type: 'attendance.verified',
        title: 'Attendance recorded',
        message: 'Your check-in was recorded.',
        receivedAt: DateTime.now(),
      ),
    );

    expect(attendance.unreadNotificationCount, 1);
    attendance.markNotificationsRead();
    expect(attendance.notifications, hasLength(1));
    expect(attendance.unreadNotificationCount, 0);
    attendance.dispose();
  });

  test('completed attendance cannot be recorded again', () {
    final attendance = AttendanceProvider();
    final now = DateTime.now();
    attendance.applyVerifiedAttendance({
      'attendance_id': 'attendance-today',
      'check_in': now.subtract(const Duration(hours: 1)).toIso8601String(),
      'check_out': now.toIso8601String(),
      'attendance_status': 'Present',
    });

    expect(attendance.todayComplete, isTrue);
    expect(
      () => attendance.recordAttendance('check-in'),
      throwsA(
        isA<StateError>().having(
          (error) => error.message,
          'message',
          'Attendance is already recorded for today.',
        ),
      ),
    );
    attendance.dispose();
  });

  testWidgets('Home shows ready instead of the stale not started label', (
    WidgetTester tester,
  ) async {
    final attendance = AttendanceProvider();
    attendance.setAuthenticatedAccount(
      id: 'employee-1',
      name: 'Test Employee',
      email: 'employee@example.com',
      role: 'employee',
    );
    attendance.isFaceEnrolled = true;

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: attendance,
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    expect(find.text('Ready'), findsOneWidget);
    expect(find.text('Not started'), findsNothing);
    attendance.dispose();
  });

  testWidgets('Home explains when an older open record needs checkout', (
    WidgetTester tester,
  ) async {
    final attendance = AttendanceProvider();
    final oldCheckIn = DateTime.now().subtract(
      const Duration(days: 1, hours: 2),
    );
    attendance.setAuthenticatedAccount(
      id: 'employee-1',
      name: 'Test Employee',
      email: 'employee@example.com',
      role: 'employee',
    );
    attendance.isFaceEnrolled = true;
    attendance.applyVerifiedAttendance({
      'attendance_id': 'attendance-old',
      'check_in': oldCheckIn.toIso8601String(),
      'check_out': null,
      'attendance_status': 'Present',
    });

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: attendance,
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    expect(find.text('Checkout required'), findsOneWidget);
    expect(find.text('Check out securely'), findsOneWidget);
    attendance.dispose();
  });

  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => AttendanceProvider()),
        ],
        child: const SecureAttendanceApp(),
      ),
    );

    // Verify that the app launches
    expect(find.byType(MaterialApp), findsOneWidget);

    // Wait for the simulated network delay in AttendanceProvider to finish
    await tester.pumpAndSettle(const Duration(seconds: 2));
  });
}
