import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../app_time.dart';
import 'auth_provider.dart';

class MobileNotification {
  MobileNotification({
    required this.type,
    required this.title,
    required this.message,
    required this.receivedAt,
    this.isRead = false,
    this.data,
  });

  final String type;
  final String title;
  final String message;
  final DateTime receivedAt;
  final bool isRead;
  final Map<String, dynamic>? data;

  factory MobileNotification.fromJson(Map<String, dynamic> json) =>
      MobileNotification(
        type: json['type']?.toString() ?? 'notification',
        title: json['title']?.toString() ?? 'Facial Recognition Attendance update',
        message:
            json['message']?.toString() ?? 'You have a new attendance update.',
        receivedAt:
            DateTime.tryParse(
              json['received_at']?.toString() ?? '',
            )?.toUtc().add(pakistanTimeOffset) ??
            pakistanNow(),
        isRead: json['is_read'] == true,
        data: json['data'] is Map
            ? Map<String, dynamic>.from(json['data'] as Map)
            : null,
      );

  Map<String, dynamic> toJson() => {
    'type': type,
    'title': title,
    'message': message,
    'received_at': receivedAt.toIso8601String(),
    'is_read': isRead,
    if (data != null) 'data': data,
  };

  MobileNotification copyWith({bool? isRead}) => MobileNotification(
    type: type,
    title: title,
    message: message,
    receivedAt: receivedAt,
    isRead: isRead ?? this.isRead,
    data: data,
  );
}

class AttendanceEntry {
  final String id;
  final String date;
  final String label;
  final String checkIn;
  final String checkOut;
  final String duration;
  final String status;

  AttendanceEntry({
    required this.id,
    required this.date,
    required this.label,
    required this.checkIn,
    required this.checkOut,
    required this.duration,
    required this.status,
  });
}

class LeaveRequest {
  final String id;
  final String type;
  final String dates;
  final String note;
  final String status;
  final String? startDate;
  final String? endDate;

  LeaveRequest({
    required this.id,
    required this.type,
    required this.dates,
    required this.note,
    required this.status,
    this.startDate,
    this.endDate,
  });
}

class ManagerLeaveRequest {
  final String id;
  final String employee;
  final String initials;
  final String type;
  final String dates;
  final String submitted;
  String status;

  ManagerLeaveRequest({
    required this.id,
    required this.employee,
    required this.initials,
    required this.type,
    required this.dates,
    required this.submitted,
    required this.status,
  });
}

class TeamAttendanceMember {
  final String id;
  final String name;
  final String initials;
  final String detail;
  final String status;

  TeamAttendanceMember({
    required this.id,
    required this.name,
    required this.initials,
    required this.detail,
    required this.status,
  });
}

class TeamAssignmentRequest {
  final String id;
  final String employeeName;
  final String employeeEmail;
  final String teamName;
  final String requestedByName;
  String status;

  TeamAssignmentRequest({
    required this.id,
    required this.employeeName,
    required this.employeeEmail,
    required this.teamName,
    required this.requestedByName,
    required this.status,
  });
}

class AttendanceExceptionItem {
  final String id;
  final String subjectUserName;
  final String exceptionType;
  final String severity;
  String status;
  final String title;
  final String message;
  final DateTime createdAt;

  AttendanceExceptionItem({
    required this.id,
    required this.subjectUserName,
    required this.exceptionType,
    required this.severity,
    required this.status,
    required this.title,
    required this.message,
    required this.createdAt,
  });
}

enum MobileAccountRole {
  organizationOwner('enterprise_admin', 'Organization Owner', true),
  hr('hr', 'HR', true),
  manager('manager', 'Manager', true),
  employee('employee', 'Employee', true),
  unknown('unknown', 'Unknown account', false);

  const MobileAccountRole(this.code, this.label, this.mobileAllowed);

  final String code;
  final String label;
  final bool mobileAllowed;

  static MobileAccountRole fromWire(String? value) {
    final normalized = value?.trim().toLowerCase();
    return MobileAccountRole.values.firstWhere(
      (role) => role.code == normalized,
      orElse: () => MobileAccountRole.unknown,
    );
  }
}

class MobileAccount {
  const MobileAccount({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });

  final String id;
  final String name;
  final String email;
  final MobileAccountRole role;
}

class AttendanceProvider with ChangeNotifier {
  WebSocket? _realtimeSocket;
  Timer? _realtimeReconnect;
  String? _realtimeAuthToken;
  bool isLoading = false;
  DateTime? checkInAt;
  DateTime? checkOutAt;
  bool _notificationsEnabled = true;
  bool _notificationSoundsEnabled = true;
  bool _notificationPermissionGranted = false;
  bool _notificationPluginReady = false;
  bool _disposed = false;
  Future<void>? _notificationInitialization;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  bool isFaceEnrolled = false;
  int _attendanceStartMinutes = 9 * 60;
  int _annualLeaveDays = 12;
  int _medicalLeaveDays = 8;
  final List<MobileNotification> notifications = [];

  bool get notificationsEnabled => _notificationsEnabled;
  bool get notificationSoundsEnabled => _notificationSoundsEnabled;
  bool get notificationPermissionGranted => _notificationPermissionGranted;
  int get unreadNotificationCount =>
      notifications.where((item) => !item.isRead).length;
  String get _notificationHistoryKey =>
      'notification_history_${currentAccount.id}';
  String get _notificationPreferencesKey =>
      'notification_preferences_${currentAccount.id}';

  // Real authentication must populate this before the organization shell opens.
  MobileAccount currentAccount = const MobileAccount(
    id: '',
    name: '',
    email: '',
    role: MobileAccountRole.unknown,
  );

  bool get mobileAccessAllowed => currentAccount.role.mobileAllowed;
  bool get canManageTeam => const {
    MobileAccountRole.organizationOwner,
    MobileAccountRole.hr,
    MobileAccountRole.manager,
  }.contains(currentAccount.role);

  int get attendanceStartMinutes => _attendanceStartMinutes;
  int get annualLeaveDays => _annualLeaveDays;
  int get medicalLeaveDays => _medicalLeaveDays;

  bool get canManageLeavePolicy => const {
    MobileAccountRole.organizationOwner,
    MobileAccountRole.hr,
  }.contains(currentAccount.role);

  String get attendanceStartTime {
    final hours = (_attendanceStartMinutes ~/ 60).toString().padLeft(2, '0');
    final minutes = (_attendanceStartMinutes % 60).toString().padLeft(2, '0');
    return '$hours:$minutes PKT';
  }

  int approvedLeaveDays(String type) {
    return _leaveRecords
        .where(
          (item) =>
              item['status']?.toString() == 'Approved' &&
              item['leave_type']?.toString() == type,
        )
        .fold(0, (total, item) {
          final start = DateTime.tryParse(item['start_date']?.toString() ?? '');
          final end = DateTime.tryParse(item['end_date']?.toString() ?? '');
          if (start == null || end == null) return total;
          return total + end.difference(start).inDays + 1;
        });
  }

  int approvedLeaveRequestCount(String type) {
    return _leaveRecords
        .where(
          (item) =>
              item['status']?.toString() == 'Approved' &&
              item['leave_type']?.toString() == type,
        )
        .length;
  }

  Future<void> _initializeNotificationPlugin() {
    return _notificationInitialization ??= _initializeNotificationPluginOnce();
  }

  Future<void> _initializeNotificationPluginOnce() async {
    try {
      final result = await _localNotifications.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(
            requestAlertPermission: false,
            requestBadgePermission: false,
            requestSoundPermission: false,
          ),
        ),
      );
      _notificationPluginReady = result ?? false;
    } catch (_) {
      _notificationPluginReady = false;
    }
  }

  Future<void> _hydrateNotificationState() async {
    if (currentAccount.id.isEmpty) return;
    try {
      await _initializeNotificationPlugin();
      final preferences = await _secureStorage.read(
        key: _notificationPreferencesKey,
      );
      if (preferences != null) {
        final payload = jsonDecode(preferences) as Map<String, dynamic>;
        _notificationsEnabled = payload['enabled'] != false;
        _notificationSoundsEnabled = payload['sounds'] != false;
      }
      final history = await _secureStorage.read(key: _notificationHistoryKey);
      if (history != null) {
        final decoded = jsonDecode(history) as List<dynamic>;
        notifications
          ..clear()
          ..addAll(
            decoded
                .whereType<Map>()
                .map(
                  (item) => MobileNotification.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .take(50),
          );
      }
      await _refreshNotificationPermission();
      notifyListeners();
    } catch (_) {
      // Local history is an enhancement; realtime attendance remains usable if storage is unavailable.
    }
  }

  Future<void> _refreshNotificationPermission() async {
    if (!_notificationPluginReady) return;
    try {
      final android = _localNotifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      if (android != null) {
        _notificationPermissionGranted =
            await android.areNotificationsEnabled() ?? false;
        return;
      }
      final ios = _localNotifications
          .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin
          >();
      if (ios != null) {
        _notificationPermissionGranted =
            (await ios.checkPermissions())?.isEnabled ?? false;
        return;
      }
      _notificationPermissionGranted = true;
    } catch (_) {
      _notificationPermissionGranted = false;
    }
  }

  Future<bool> requestNotificationPermission() async {
    await _initializeNotificationPlugin();
    try {
      final android = _localNotifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      final ios = _localNotifications
          .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin
          >();
      bool? granted;
      if (android != null) {
        granted = await android.requestNotificationsPermission();
      } else if (ios != null) {
        granted = await ios.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );
      } else {
        granted = true;
      }
      _notificationPermissionGranted = granted ?? false;
      if (!_disposed) {
        notifyListeners();
      }
      return _notificationPermissionGranted;
    } catch (_) {
      _notificationPermissionGranted = false;
      if (!_disposed) {
        notifyListeners();
      }
      return false;
    }
  }

  Future<void> _persistNotificationPreferences() async {
    if (currentAccount.id.isEmpty) return;
    try {
      await _secureStorage.write(
        key: _notificationPreferencesKey,
        value: jsonEncode({
          'enabled': _notificationsEnabled,
          'sounds': _notificationSoundsEnabled,
        }),
      );
    } catch (_) {}
  }

  Future<void> _persistNotificationHistory() async {
    if (currentAccount.id.isEmpty) return;
    try {
      await _secureStorage.write(
        key: _notificationHistoryKey,
        value: jsonEncode(notifications.map((item) => item.toJson()).toList()),
      );
    } catch (_) {}
  }

  Future<void> clearNotificationHistory() async {
    notifications.clear();
    await _persistNotificationHistory();
    notifyListeners();
  }

  void _addNotification(Map<String, dynamic> payload) {
    final type = payload['type'] as String?;
    if (type == null || type == 'connection.ready') return;
    notifications.insert(
      0,
      MobileNotification(
        type: type,
        title: payload['title'] as String? ?? 'Facial Recognition Attendance update',
        message:
            payload['message'] as String? ??
            'You have a new attendance update.',
        receivedAt: pakistanNow(),
        data: payload['data'] is Map
            ? Map<String, dynamic>.from(payload['data'] as Map)
            : null,
      ),
    );
    if (notifications.length > 50) {
      notifications.removeLast();
    }
    unawaited(_persistNotificationHistory());
    _showLocalNotification(notifications.first);
  }

  void _showLocalNotification(MobileNotification item) {
    if (!_notificationPluginReady ||
        !_notificationPermissionGranted ||
        !_notificationsEnabled) {
      return;
    }
    final soundEnabled = _notificationSoundsEnabled;
    unawaited(
      _localNotifications
          .show(
            id: item.receivedAt.microsecondsSinceEpoch.remainder(2147483647),
            title: item.title,
            body: item.message,
            notificationDetails: NotificationDetails(
              android: AndroidNotificationDetails(
                'attendance_updates',
                'Attendance updates',
                channelDescription:
                    'Realtime attendance and organization updates.',
                importance: Importance.defaultImportance,
                priority: Priority.defaultPriority,
                playSound: soundEnabled,
              ),
              iOS: DarwinNotificationDetails(
                presentAlert: true,
                presentBadge: true,
                presentSound: soundEnabled,
              ),
            ),
          )
          .catchError((_) {}),
    );
  }

  void setAuthenticatedAccount({
    required String id,
    required String name,
    required String email,
    required String role,
    String? authToken,
  }) {
    final accountChanged = currentAccount.id != id;
    currentAccount = MobileAccount(
      id: id,
      name: name,
      email: email,
      role: MobileAccountRole.fromWire(role),
    );
    if (accountChanged) {
      notifications.clear();
      _notificationsEnabled = true;
      _notificationSoundsEnabled = true;
      _notificationPermissionGranted = false;
    }
    unawaited(_hydrateNotificationState());
    notifyListeners();
    if (authToken != null) {
      _connectRealtime(authToken);
      loadAttendance(authToken);
      loadLeaveRequests(authToken);
      loadManagementData(authToken);
    }
  }

  Future<void> _connectRealtime(String token) async {
    _realtimeAuthToken = token;
    if (!_notificationsEnabled) return;
    await _realtimeSocket?.close();
    _realtimeSocket = null;
    _realtimeReconnect?.cancel();
    try {
      final response = await http.get(
        Uri.parse('${AuthProvider.baseUrl}/v1/notifications/token'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode != 200) return;
      final websocketToken =
          (jsonDecode(response.body) as Map<String, dynamic>)['token']
              as String?;
      if (websocketToken == null || currentAccount.id.isEmpty) return;
      final base = Uri.parse(AuthProvider.baseUrl);
      final socketUri = base.replace(
        scheme: base.scheme == 'https' ? 'wss' : 'ws',
        path: '/v1/notifications/ws',
        queryParameters: {
          'user_id': currentAccount.id,
          'token': websocketToken,
        },
      );
      final socket = await WebSocket.connect(socketUri.toString());
      _realtimeSocket = socket;
      socket.listen(
        (message) {
          if (message is! String || !_notificationsEnabled) return;
          try {
            final payload = jsonDecode(message) as Map<String, dynamic>;
            final type = payload['type'] as String?;
            if (type == null || type == 'connection.ready') return;
            _addNotification(payload);
            if (type == 'attendance.verified') {
              final data = Map<String, dynamic>.from(
                (payload['data'] as Map?) ?? const {},
              );
              if (data['user_id'] == currentAccount.id) {
                applyVerifiedAttendance(data);
              }
            }
            notifyListeners();
          } catch (_) {
            // Ignore malformed realtime messages.
          }
        },
        onDone: () {
          _realtimeSocket = null;
          if (_realtimeAuthToken != null && _notificationsEnabled) {
            _scheduleRealtimeReconnect(_realtimeAuthToken!);
          }
        },
        onError: (_) {
          _realtimeSocket = null;
          if (_realtimeAuthToken != null && _notificationsEnabled) {
            _scheduleRealtimeReconnect(_realtimeAuthToken!);
          }
        },
      );
    } catch (_) {
      if (_notificationsEnabled) {
        _scheduleRealtimeReconnect(token);
      }
    }
  }

  void _scheduleRealtimeReconnect(String token) {
    _realtimeReconnect?.cancel();
    _realtimeReconnect = Timer(
      const Duration(seconds: 5),
      () => _connectRealtime(token),
    );
  }

  void setNotificationSoundsEnabled(bool enabled) {
    _notificationSoundsEnabled = enabled;
    unawaited(_persistNotificationPreferences());
    notifyListeners();
  }

  void setNotificationsEnabled(bool enabled) {
    _notificationsEnabled = enabled;
    unawaited(_persistNotificationPreferences());
    _realtimeReconnect?.cancel();
    if (!enabled) {
      _realtimeSocket?.close();
      _realtimeSocket = null;
    } else {
      unawaited(requestNotificationPermission());
      if (_realtimeAuthToken != null) {
        _connectRealtime(_realtimeAuthToken!);
      }
    }
    notifyListeners();
  }

  void markNotificationsRead() {
    if (notifications.isEmpty || unreadNotificationCount == 0) {
      return;
    }
    for (var index = 0; index < notifications.length; index++) {
      notifications[index] = notifications[index].copyWith(isRead: true);
    }
    unawaited(_persistNotificationHistory());
    notifyListeners();
  }

  Future<void> clearAuthenticatedAccount() async {
    _realtimeAuthToken = null;
    _realtimeReconnect?.cancel();
    await _realtimeSocket?.close();
    _realtimeSocket = null;
    currentAccount = const MobileAccount(
      id: '',
      name: '',
      email: '',
      role: MobileAccountRole.unknown,
    );
    checkInAt = null;
    checkOutAt = null;
    isFaceEnrolled = false;
    _attendanceStartMinutes = 9 * 60;
    _annualLeaveDays = 12;
    _medicalLeaveDays = 8;
    entries.clear();
    leaveRequests.clear();
    managerLeaveRequests.clear();
    teamAttendance.clear();
    teamAssignmentRequests.clear();
    attendanceExceptions.clear();
    _directoryAccounts.clear();
    _attendanceRecords.clear();
    _leaveRecords.clear();
    notifications.clear();
    isLoading = false;
    notifyListeners();
  }

  Future<void> loadAttendance(String token) async {
    isLoading = true;
    notifyListeners();
    try {
      final response = await http.get(
        Uri.parse('${AuthProvider.baseUrl}/v1/organization/directory'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode != 200) return;
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      final policy = payload['attendance_policy'];
      if (policy is Map) {
        _attendanceStartMinutes =
            (policy['start_minutes'] as num?)?.toInt() ?? 9 * 60;
      }
      final leavePolicy = payload['leave_policy'];
      if (leavePolicy is Map) {
        _annualLeaveDays = (leavePolicy['annual_days'] as num?)?.toInt() ?? 12;
        _medicalLeaveDays = (leavePolicy['medical_days'] as num?)?.toInt() ?? 8;
      }
      final accounts = (payload['accounts'] as List? ?? const [])
          .whereType<Map>();
      final currentRecord = accounts.cast<Map?>().firstWhere(
        (item) => item?['id']?.toString() == currentAccount.id,
        orElse: () => null,
      );
      isFaceEnrolled =
          currentRecord?['recognition_status']?.toString() == 'enrolled';
      final rawEntries = (payload['attendance'] as List? ?? const [])
          .whereType<Map>()
          .map((item) {
            final checkIn = parseApiTimestamp(item['check_in'] as String);
            final checkOutValue = item['check_out'];
            final checkOut = checkOutValue is String
                ? parseApiTimestamp(checkOutValue)
                : null;
            return AttendanceEntry(
              id: item['id'].toString(),
              date: checkIn.toIso8601String().substring(0, 10),
              label: _isToday(checkIn) ? 'Today' : _displayDate(checkIn),
              checkIn: _displayTime(checkIn),
              checkOut: checkOut == null ? '—' : _displayTime(checkOut),
              duration: checkOut == null
                  ? 'In progress'
                  : _calculateDuration(checkIn, checkOut),
              status: _statusForCheckIn(checkIn, item['status']?.toString()),
            );
          })
          .where((entry) => entry.id.isNotEmpty)
          .toList();
      _directoryAccounts
        ..clear()
        ..addAll(accounts.map((item) => Map<String, dynamic>.from(item)));
      _attendanceRecords
        ..clear()
        ..addAll(
          (payload['attendance'] as List? ?? const []).whereType<Map>().map(
            (item) => Map<String, dynamic>.from(item),
          ),
        );
      entries
        ..clear()
        ..addAll(rawEntries);
      _applyApprovedLeaveStatus();
      _rebuildTeamAttendance();
      final today = rawEntries.cast<AttendanceEntry?>().firstWhere(
        (entry) => entry != null && entry.label == 'Today',
        orElse: () => null,
      );
      final openAttendance = payload['open_attendance'];
      if (today == null &&
          openAttendance is Map &&
          openAttendance['check_in'] is String) {
        checkInAt = parseApiTimestamp(openAttendance['check_in'] as String);
        checkOutAt = null;
      } else if (today == null) {
        checkInAt = null;
        checkOutAt = null;
      } else {
        final source = (payload['attendance'] as List? ?? const [])
            .whereType<Map>()
            .firstWhere((item) => item['id'].toString() == today.id);
        checkInAt = parseApiTimestamp(source['check_in'] as String);
        checkOutAt = source['check_out'] is String
            ? parseApiTimestamp(source['check_out'] as String)
            : null;
      }
      notifyListeners();
    } catch (_) {
      // Keep the shell usable if history is temporarily unavailable.
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  bool _isToday(DateTime value) {
    final now = pakistanNow();
    return value.year == now.year &&
        value.month == now.month &&
        value.day == now.day;
  }

  String _statusForCheckIn(DateTime checkIn, String? reportedStatus) {
    if (reportedStatus != null && reportedStatus != 'Present') {
      return reportedStatus;
    }
    return checkIn.hour * 60 + checkIn.minute >= _attendanceStartMinutes
        ? 'Late'
        : 'Present';
  }

  bool _leaveCoversDate(Map<String, dynamic> item, DateTime date) {
    final start = DateTime.tryParse(item['start_date']?.toString() ?? '');
    final end = DateTime.tryParse(item['end_date']?.toString() ?? '');
    if (start == null || end == null) return false;
    final day = DateTime(date.year, date.month, date.day);
    final first = DateTime(start.year, start.month, start.day);
    final last = DateTime(end.year, end.month, end.day);
    return !day.isBefore(first) && !day.isAfter(last);
  }

  bool _isUserOnLeave(String userId) {
    final today = pakistanNow();
    return _leaveRecords.any(
      (item) =>
          item['requester_id']?.toString() == userId &&
          item['status']?.toString() == 'approved' &&
          _leaveCoversDate(item, today),
    );
  }

  void _applyApprovedLeaveStatus() {
    entries.removeWhere((entry) => entry.status == 'On leave');
    final attendanceDates = _attendanceRecords
        .where((item) => item['check_in'] is String)
        .map(
          (item) => parseApiTimestamp(
            item['check_in'] as String,
          ).toIso8601String().substring(0, 10),
        )
        .toSet();
    final approved = _leaveRecords.where(
      (item) =>
          item['requester_id']?.toString() == currentAccount.id &&
          item['status']?.toString() == 'approved',
    );
    for (final item in approved) {
      final start = DateTime.tryParse(item['start_date']?.toString() ?? '');
      final end = DateTime.tryParse(item['end_date']?.toString() ?? '');
      if (start == null || end == null) continue;
      for (
        var day = DateTime(start.year, start.month, start.day);
        !day.isAfter(DateTime(end.year, end.month, end.day));
        day = day.add(const Duration(days: 1))
      ) {
        final date = day.toIso8601String().substring(0, 10);
        if (attendanceDates.contains(date)) continue;
        entries.add(
          AttendanceEntry(
            id: 'leave-${item['id']}-$date',
            date: date,
            label: _isToday(day) ? 'Today' : _displayDate(day),
            checkIn: '—',
            checkOut: '—',
            duration: '—',
            status: 'On leave',
          ),
        );
      }
    }
    entries.sort((left, right) => right.date.compareTo(left.date));
  }

  void _rebuildTeamAttendance() {
    teamAttendance
      ..clear()
      ..addAll(
        _directoryAccounts.map((account) {
          final userId = account['id']?.toString() ?? '';
          final records =
              _attendanceRecords
                  .where(
                    (item) =>
                        item['user_id']?.toString() == userId &&
                        item['check_in'] is String,
                  )
                  .toList()
                ..sort(
                  (left, right) => right['check_in'].toString().compareTo(
                    left['check_in'].toString(),
                  ),
                );
          final latest = records.isEmpty ? null : records.first;
          final checkIn = latest == null
              ? null
              : parseApiTimestamp(latest['check_in'] as String);
          final checkedOut = latest?['check_out'] is String;
          final status = _isUserOnLeave(userId)
              ? 'On leave'
              : latest == null
              ? 'Not checked in'
              : checkedOut
              ? 'Checked out'
              : _statusForCheckIn(checkIn!, latest['status']?.toString());
          final detail = status == 'On leave'
              ? 'Approved leave'
              : checkIn == null
              ? (account['department']?.toString() ?? 'No attendance yet')
              : checkedOut
              ? 'Checked out ${_displayTime(parseApiTimestamp(latest!['check_out'] as String))}'
              : 'Checked in ${_displayTime(checkIn)}';
          final name = account['name']?.toString() ?? 'Employee';
          final initials = name
              .split(' ')
              .where((part) => part.isNotEmpty)
              .take(2)
              .map((part) => part[0])
              .join()
              .toUpperCase();
          return TeamAttendanceMember(
            id: userId,
            name: name,
            initials: initials,
            detail: detail,
            status: status,
          );
        }),
      );
  }

  @override
  void dispose() {
    _disposed = true;
    _realtimeAuthToken = null;
    _realtimeReconnect?.cancel();
    _realtimeSocket?.close();
    super.dispose();
  }

  List<AttendanceEntry> entries = [];
  List<LeaveRequest> leaveRequests = [];
  List<ManagerLeaveRequest> managerLeaveRequests = [];
  List<TeamAttendanceMember> teamAttendance = [];
  List<TeamAssignmentRequest> teamAssignmentRequests = [];
  List<AttendanceExceptionItem> attendanceExceptions = [];
  final List<Map<String, dynamic>> _directoryAccounts = [];
  final List<Map<String, dynamic>> _attendanceRecords = [];
  final List<Map<String, dynamic>> _leaveRecords = [];

  bool get todayComplete {
    final now = pakistanNow();
    bool sameDay(DateTime? value) =>
        value != null &&
        value.year == now.year &&
        value.month == now.month &&
        value.day == now.day;
    if (sameDay(checkInAt) && sameDay(checkOutAt)) return true;
    final today = now.toIso8601String().substring(0, 10);
    return entries.any((entry) => entry.date == today && entry.checkOut != '—');
  }

  static String _displayTime(DateTime date) {
    int hour = date.hour;
    final minute = date.minute.toString().padLeft(2, '0');
    final period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour == 0) hour = 12;
    return '$hour:$minute $period';
  }

  static String _displayDate(DateTime date) {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${weekdays[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}';
  }

  String _calculateDuration(DateTime start, DateTime end) {
    final diff = end.difference(start);
    final hours = diff.inHours;
    final minutes = diff.inMinutes.remainder(60);
    return '${hours}h ${minutes}m';
  }

  void applyVerifiedAttendance(Map<String, dynamic> payload) {
    final checkIn = parseApiTimestamp(payload['check_in'] as String);
    final checkOutValue = payload['check_out'];
    final checkOut = checkOutValue is String
        ? parseApiTimestamp(checkOutValue)
        : null;
    final now = pakistanNow();
    final isToday =
        checkIn.year == now.year &&
        checkIn.month == now.month &&
        checkIn.day == now.day;
    final entry = AttendanceEntry(
      id: payload['attendance_id'] as String,
      date: checkIn.toIso8601String().substring(0, 10),
      label: isToday ? 'Today' : _displayDate(checkIn),
      checkIn: _displayTime(checkIn),
      checkOut: checkOut == null ? '—' : _displayTime(checkOut),
      duration: checkOut == null
          ? 'In progress'
          : _calculateDuration(checkIn, checkOut),
      status: _statusForCheckIn(
        checkIn,
        payload['attendance_status'] as String?,
      ),
    );
    checkInAt = checkIn;
    checkOutAt = checkOut;
    entries.removeWhere(
      (existing) =>
          existing.id == entry.id || (isToday && existing.label == 'Today'),
    );
    entries.insert(0, entry);
    notifyListeners();
  }

  AttendanceEntry recordAttendance(String action) {
    if (todayComplete) {
      throw StateError('Attendance is already recorded for today.');
    }
    final now = pakistanNow();
    late AttendanceEntry updatedEntry;

    if (action == "check-in") {
      updatedEntry = AttendanceEntry(
        id: "today-${now.millisecondsSinceEpoch}",
        date: now.toIso8601String().substring(0, 10),
        label: "Today",
        checkIn: _displayTime(now),
        checkOut: "—",
        duration: "In progress",
        status: _statusForCheckIn(now, null),
      );
      checkInAt = now;
      checkOutAt = null;
      entries.removeWhere((e) => e.label == "Today");
      entries.insert(0, updatedEntry);
    } else {
      final start = checkInAt ?? now;
      updatedEntry = AttendanceEntry(
        id: "today-${now.millisecondsSinceEpoch}",
        date: now.toIso8601String().substring(0, 10),
        label: "Today",
        checkIn: _displayTime(start),
        checkOut: _displayTime(now),
        duration: _calculateDuration(start, now),
        status: _statusForCheckIn(start, null),
      );
      checkInAt = start;
      checkOutAt = now;
      entries.removeWhere((e) => e.label == "Today");
      entries.insert(0, updatedEntry);
    }

    notifyListeners();
    return updatedEntry;
  }

  String _leaveStatus(String status) => status == 'approved'
      ? 'Approved'
      : status == 'rejected'
      ? 'Declined'
      : 'Pending';

  String _leaveDates(Map<String, dynamic> item) {
    final start = DateTime.parse(item['start_date'] as String);
    final end = DateTime.parse(item['end_date'] as String);
    return item['start_date'] == item['end_date']
        ? _displayDate(start)
        : '${_displayDate(start)} – ${_displayDate(end)}';
  }

  LeaveRequest _leaveRequestFromApi(Map<String, dynamic> item) => LeaveRequest(
    id: item['id'].toString(),
    type: item['leave_type'] as String,
    dates: _leaveDates(item),
    note: (item['note'] as String?) ?? '',
    status: _leaveStatus(item['status'] as String),
    startDate: item['start_date']?.toString(),
    endDate: item['end_date']?.toString(),
  );

  ManagerLeaveRequest _managerLeaveFromApi(Map<String, dynamic> item) {
    final name = item['requester_name'] as String;
    final parts = name.split(' ').where((part) => part.isNotEmpty).toList();
    final initials = parts.take(2).map((part) => part[0]).join().toUpperCase();
    return ManagerLeaveRequest(
      id: item['id'].toString(),
      employee: name,
      initials: initials,
      type: item['leave_type'] as String,
      dates: _leaveDates(item),
      submitted: _displayDate(parseApiTimestamp(item['created_at'] as String)),
      status: _leaveStatus(item['status'] as String),
    );
  }

  Future<String?> updateAttendancePolicy(String startTime) async {
    if (!canManageTeam) {
      return 'Only management roles can change attendance time.';
    }
    final token = _realtimeAuthToken;
    if (token == null) {
      return 'Sign in to manage the attendance schedule.';
    }
    try {
      final response = await http.put(
        Uri.parse('${AuthProvider.baseUrl}/v1/organization/attendance-policy'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'start_time': startTime}),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        try {
          final payload = jsonDecode(response.body);
          if (payload is Map && payload['detail'] is String) {
            return payload['detail'] as String;
          }
        } catch (_) {}
        return 'Unable to update the attendance schedule.';
      }
      final policy = jsonDecode(response.body) as Map<String, dynamic>;
      _attendanceStartMinutes =
          (policy['start_minutes'] as num?)?.toInt() ?? _attendanceStartMinutes;
      notifyListeners();
      return null;
    } catch (_) {
      return 'Unable to reach the attendance service.';
    }
  }

  Future<String?> updateLeavePolicy(int annualDays, int medicalDays) async {
    if (!canManageLeavePolicy) {
      return 'Only the organization owner or HR can change leave allowances.';
    }
    if (annualDays < 0 ||
        annualDays > 365 ||
        medicalDays < 0 ||
        medicalDays > 365) {
      return 'Leave allowances must be between 0 and 365 days.';
    }
    final token = _realtimeAuthToken;
    if (token == null) return 'Sign in to manage leave allowances.';
    try {
      final response = await http.put(
        Uri.parse('${AuthProvider.baseUrl}/v1/organization/leave-policy'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'annual_days': annualDays,
          'medical_days': medicalDays,
        }),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        try {
          final payload = jsonDecode(response.body);
          if (payload is Map && payload['detail'] is String) {
            return payload['detail'] as String;
          }
        } catch (_) {}
        return 'Unable to update leave allowances.';
      }
      final policy = jsonDecode(response.body) as Map<String, dynamic>;
      _annualLeaveDays = (policy['annual_days'] as num?)?.toInt() ?? annualDays;
      _medicalLeaveDays =
          (policy['medical_days'] as num?)?.toInt() ?? medicalDays;
      notifyListeners();
      return null;
    } catch (_) {
      return 'Unable to reach the attendance service.';
    }
  }

  TeamAssignmentRequest _teamAssignmentFromApi(Map<String, dynamic> item) =>
      TeamAssignmentRequest(
        id: item['id'].toString(),
        employeeName: item['employee_name']?.toString() ?? 'Employee',
        employeeEmail: item['employee_email']?.toString() ?? '',
        teamName: item['team_name']?.toString() ?? 'Team',
        requestedByName: item['requested_by_name']?.toString() ?? 'Manager',
        status: _requestStatus(item['status']?.toString()),
      );

  String _requestStatus(String? status) => status == 'approved'
      ? 'Approved'
      : status == 'rejected'
      ? 'Declined'
      : 'Pending';

  AttendanceExceptionItem _exceptionFromApi(Map<String, dynamic> item) =>
      AttendanceExceptionItem(
        id: item['id'].toString(),
        subjectUserName: item['subject_user_name']?.toString() ?? 'Employee',
        exceptionType: item['exception_type']?.toString() ?? 'attendance',
        severity: item['severity']?.toString() ?? 'medium',
        status: item['status']?.toString() ?? 'open',
        title: item['title']?.toString() ?? 'Attendance exception',
        message: item['message']?.toString() ?? '',
        createdAt: parseApiTimestamp(item['created_at']?.toString() ?? ''),
      );

  Future<void> loadManagementData(String token) async {
    if (!canManageTeam) return;
    await Future.wait([
      _loadTeamAssignmentRequests(token),
      _loadAttendanceExceptions(token),
    ]);
    notifyListeners();
  }

  Future<void> _loadTeamAssignmentRequests(String token) async {
    try {
      final response = await http.get(
        Uri.parse('${AuthProvider.baseUrl}/v1/organization/team-requests'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode != 200) return;
      final items = (jsonDecode(response.body) as List)
          .whereType<Map>()
          .map(
            (item) => _teamAssignmentFromApi(Map<String, dynamic>.from(item)),
          )
          .toList();
      teamAssignmentRequests
        ..clear()
        ..addAll(items);
    } catch (_) {}
  }

  Future<void> _loadAttendanceExceptions(String token) async {
    try {
      final response = await http.get(
        Uri.parse('${AuthProvider.baseUrl}/v1/organization/exceptions'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode != 200) return;
      final items = (jsonDecode(response.body) as List)
          .whereType<Map>()
          .map((item) => _exceptionFromApi(Map<String, dynamic>.from(item)))
          .toList();
      attendanceExceptions
        ..clear()
        ..addAll(items);
    } catch (_) {}
  }

  Future<bool> reviewTeamAssignment(String id, String status) async {
    if (!canManageLeavePolicy) return false;
    final token = _realtimeAuthToken;
    if (token == null) return false;
    final decision = status == 'Approved' ? 'approve' : 'reject';
    try {
      final response = await http.post(
        Uri.parse(
          '${AuthProvider.baseUrl}/v1/organization/team-requests/$id/$decision',
        ),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode < 200 || response.statusCode >= 300) return false;
      final updated = _teamAssignmentFromApi(
        jsonDecode(response.body) as Map<String, dynamic>,
      );
      final index = teamAssignmentRequests.indexWhere((item) => item.id == id);
      if (index != -1) teamAssignmentRequests[index] = updated;
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> reviewAttendanceException(String id, String status) async {
    if (!canManageTeam) return false;
    final token = _realtimeAuthToken;
    if (token == null) return false;
    final decision = status == 'resolved' ? 'resolved' : 'acknowledged';
    try {
      final response = await http.post(
        Uri.parse(
          '${AuthProvider.baseUrl}/v1/organization/exceptions/$id/review',
        ),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'status': decision}),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) return false;
      final updated = _exceptionFromApi(
        jsonDecode(response.body) as Map<String, dynamic>,
      );
      final index = attendanceExceptions.indexWhere((item) => item.id == id);
      if (index != -1) attendanceExceptions[index] = updated;
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> loadLeaveRequests(String token) async {
    try {
      final response = await http.get(
        Uri.parse('${AuthProvider.baseUrl}/v1/organization/leave-requests'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode != 200) return;
      final items = (jsonDecode(response.body) as List)
          .cast<Map<String, dynamic>>();
      _leaveRecords
        ..clear()
        ..addAll(items.map((item) => Map<String, dynamic>.from(item)));
      leaveRequests = items
          .where((item) => item['requester_id'].toString() == currentAccount.id)
          .map(_leaveRequestFromApi)
          .toList();
      managerLeaveRequests = items.map(_managerLeaveFromApi).toList();
      _applyApprovedLeaveStatus();
      _rebuildTeamAttendance();
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> submitLeave(
    String type,
    String startDate,
    String endDate,
    String note,
  ) async {
    final token = _realtimeAuthToken;
    if (token == null || endDate.compareTo(startDate) < 0) return false;
    try {
      final response = await http.post(
        Uri.parse('${AuthProvider.baseUrl}/v1/organization/leave-requests'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'leave_type': type,
          'start_date': startDate,
          'end_date': endDate,
          'note': note.trim().isEmpty ? null : note.trim(),
        }),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) return false;
      final item = jsonDecode(response.body) as Map<String, dynamic>;
      leaveRequests.insert(0, _leaveRequestFromApi(item));
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> reviewManagerLeave(String id, String status) async {
    final token = _realtimeAuthToken;
    if (token == null) return false;
    try {
      final decision = status == 'Approved' ? 'approve' : 'reject';
      final response = await http.post(
        Uri.parse(
          '${AuthProvider.baseUrl}/v1/organization/leave-requests/$id/$decision',
        ),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode < 200 || response.statusCode >= 300) return false;
      final item = jsonDecode(response.body) as Map<String, dynamic>;
      final updated = _managerLeaveFromApi(item);
      final index = managerLeaveRequests.indexWhere(
        (request) => request.id == id,
      );
      if (index != -1) managerLeaveRequests[index] = updated;
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }
}
