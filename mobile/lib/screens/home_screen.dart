import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_time.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';
import '../providers/attendance_provider.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  String _formatNotificationTime(DateTime date) {
    final now = pakistanNow();
    if (date.year == now.year &&
        date.month == now.month &&
        date.day == now.day) {
      final hour = date.hour == 0
          ? 12
          : date.hour > 12
          ? date.hour - 12
          : date.hour;
      final minute = date.minute.toString().padLeft(2, '0');
      return 'Today, $hour:$minute ${date.hour >= 12 ? 'PM' : 'AM'}';
    }
    return '${date.day}/${date.month}/${date.year}';
  }

  Widget _leaveOverviewCard(AttendanceProvider attendance) {
    Widget leaveTile({
      required String type,
      required IconData icon,
      required Color surface,
      required Color color,
    }) {
      final days = attendance.approvedLeaveDays(type);
      final requests = attendance.approvedLeaveRequestCount(type);
      return Expanded(
        child: FrostedCard(
          padding: const EdgeInsets.all(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: surface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 19, color: color),
              ),
              const SizedBox(height: 12),
              Text(
                type,
                style: const TextStyle(
                  color: AppPalette.ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$days approved day${days == 1 ? '' : 's'}',
                style: const TextStyle(
                  color: AppPalette.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                requests == 0
                    ? 'No approved requests'
                    : '$requests approved request${requests == 1 ? '' : 's'}',
                style: const TextStyle(color: AppPalette.muted, fontSize: 11),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Time off',
          style: TextStyle(
            color: AppPalette.blue,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 5),
        const Text(
          'Leave overview',
          style: TextStyle(
            color: AppPalette.ink,
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Approved leave across your current workspace.',
          style: TextStyle(color: AppPalette.muted, fontSize: 13),
        ),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            leaveTile(
              type: 'Annual leave',
              icon: Icons.calendar_today,
              surface: AppPalette.blueSoft,
              color: AppPalette.blue,
            ),
            const SizedBox(width: 10),
            leaveTile(
              type: 'Medical leave',
              icon: Icons.medical_services_outlined,
              surface: AppPalette.roseSoft,
              color: AppPalette.rose,
            ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final attendance = context.watch<AttendanceProvider>();
    final account = attendance.currentAccount;
    final displayName = account.name.trim().isEmpty
        ? "Your workspace"
        : account.name;
    final needsEnrollment = !attendance.isFaceEnrolled;
    final todayKey = pakistanNow().toIso8601String().substring(0, 10);
    final todayEntry = attendance.entries.cast<AttendanceEntry?>().firstWhere(
      (entry) => entry?.date == todayKey,
      orElse: () => null,
    );
    final isOnLeave = todayEntry?.status == 'On leave';
    final isCheckedOut = attendance.todayComplete;
    final isCheckedIn =
        !isCheckedOut &&
        attendance.checkInAt != null &&
        attendance.checkOutAt == null;
    final String? action = isOnLeave
        ? null
        : needsEnrollment
        ? "enroll"
        : isCheckedIn
        ? "check-out"
        : "check-in";

    String workedLabel() {
      if (isCheckedIn) {
        return "In progress";
      }
      if (!isCheckedOut ||
          attendance.checkInAt == null ||
          attendance.checkOutAt == null) {
        return "—";
      }
      final duration = attendance.checkOutAt!.difference(attendance.checkInAt!);
      final hours = duration.inHours;
      final minutes = duration.inMinutes.remainder(60);
      if (hours == 0) {
        return "${minutes}m";
      }
      if (minutes == 0) {
        return "${hours}h";
      }
      return "${hours}h ${minutes}m";
    }

    final worked = workedLabel();

    String greeting() {
      final hour = pakistanNow().hour;
      if (hour < 12) return "Good morning";
      if (hour < 18) return "Good afternoon";
      return "Good evening";
    }

    final displayDate =
        "${pakistanNow().day}/${pakistanNow().month}/${pakistanNow().year}";
    final statusTitle = isOnLeave
        ? "On leave today"
        : needsEnrollment
        ? "Enroll your face"
        : isCheckedOut
        ? "Day complete"
        : isCheckedIn
        ? "Checkout required"
        : "Ready when you are";
    final statusCopy = isOnLeave
        ? "An approved leave record covers today. Attendance capture is not required."
        : needsEnrollment
        ? "Enroll one attendance photo before your first check-in."
        : isCheckedOut
        ? "Your local attendance record is up to date."
        : isCheckedIn
        ? "An open attendance record needs your checkout."
        : "No attendance has been recorded today.";

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        greeting(),
                        style: const TextStyle(
                          color: AppPalette.muted,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        displayName,
                        style: const TextStyle(
                          color: AppPalette.ink,
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      AppIconButton(
                        icon: Icons.notifications_none,
                        onPressed: () async {
                          final items = List<MobileNotification>.from(
                            attendance.notifications,
                          );
                          attendance.markNotificationsRead();
                          await showModalBottomSheet<void>(
                            context: context,
                            backgroundColor: Colors.transparent,
                            builder: (sheetContext) => Container(
                              padding: const EdgeInsets.fromLTRB(
                                22,
                                12,
                                22,
                                28,
                              ),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.vertical(
                                  top: Radius.circular(28),
                                ),
                              ),
                              child: SafeArea(
                                top: false,
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Center(
                                      child: Container(
                                        width: 38,
                                        height: 4,
                                        decoration: BoxDecoration(
                                          color: AppPalette.line,
                                          borderRadius: BorderRadius.circular(
                                            4,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 20),
                                    const Text(
                                      'Notifications',
                                      style: TextStyle(
                                        color: AppPalette.ink,
                                        fontSize: 22,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    if (items.isNotEmpty)
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: TextButton.icon(
                                          onPressed: () async {
                                            await attendance
                                                .clearNotificationHistory();
                                            if (sheetContext.mounted) {
                                              Navigator.of(sheetContext).pop();
                                            }
                                          },
                                          icon: const Icon(
                                            Icons.delete_outline,
                                            size: 17,
                                          ),
                                          label: const Text('Clear history'),
                                        ),
                                      ),
                                    if (items.isEmpty)
                                      const Padding(
                                        padding: EdgeInsets.symmetric(
                                          vertical: 28,
                                        ),
                                        child: Column(
                                          children: [
                                            Icon(
                                              Icons.notifications_none,
                                              color: AppPalette.muted,
                                              size: 30,
                                            ),
                                            SizedBox(height: 10),
                                            Text(
                                              'You’re all caught up.',
                                              style: TextStyle(
                                                color: AppPalette.muted,
                                                fontSize: 14,
                                              ),
                                            ),
                                          ],
                                        ),
                                      )
                                    else
                                      ...items.map(
                                        (item) => ListTile(
                                          contentPadding: EdgeInsets.zero,
                                          onTap:
                                              item.data?['action_url'] != null
                                              ? () {
                                                  Navigator.of(
                                                    sheetContext,
                                                  ).pop();
                                                  Navigator.of(
                                                    context,
                                                  ).pushNamed(
                                                    '/exceptions',
                                                    arguments: item.data,
                                                  );
                                                }
                                              : null,
                                          leading: const CircleAvatar(
                                            backgroundColor:
                                                AppPalette.blueSoft,
                                            child: Icon(
                                              Icons.info_outline,
                                              color: AppPalette.blue,
                                              size: 19,
                                            ),
                                          ),
                                          title: Text(
                                            item.title,
                                            style: const TextStyle(
                                              color: AppPalette.ink,
                                              fontSize: 14,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          subtitle: Text(
                                            '${item.message}\n${_formatNotificationTime(item.receivedAt)}',
                                            style: const TextStyle(
                                              color: AppPalette.muted,
                                              fontSize: 13,
                                              height: 1.35,
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                      if (attendance.unreadNotificationCount > 0)
                        Positioned(
                          right: -2,
                          top: -2,
                          child: Container(
                            constraints: const BoxConstraints(
                              minWidth: 17,
                              minHeight: 17,
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: AppPalette.rose,
                              borderRadius: BorderRadius.circular(9),
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                            child: Text(
                              '${attendance.unreadNotificationCount}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 18),
              FrostedCard(
                color: AppPalette.ink,
                padding: const EdgeInsets.all(23),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (attendance.isLoading) ...[
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Skeleton(width: 80, height: 16),
                              SizedBox(height: 7),
                              Skeleton(width: 140, height: 32),
                            ],
                          ),
                          const Skeleton(
                            width: 70,
                            height: 26,
                            borderRadius: BorderRadius.all(Radius.circular(13)),
                          ),
                        ] else ...[
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                displayDate,
                                style: const TextStyle(
                                  color: Color(0xFFBDC8D9),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 7),
                              Text(
                                statusTitle,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 25,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          StatusPill(
                            label: isOnLeave
                                ? "On leave"
                                : needsEnrollment
                                ? "Setup"
                                : isCheckedOut
                                ? "Complete"
                                : isCheckedIn
                                ? "Checkout"
                                : "Ready",
                            tone: isOnLeave
                                ? "blue"
                                : needsEnrollment
                                ? "amber"
                                : isCheckedOut || isCheckedIn
                                ? "mint"
                                : "blue",
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (attendance.isLoading)
                      const Skeleton(width: 220, height: 18)
                    else
                      Text(
                        statusCopy,
                        style: const TextStyle(
                          color: Color(0xFFD0D8E6),
                          fontSize: 15,
                          height: 1.4,
                        ),
                      ),
                    const SizedBox(height: 21),
                    Container(
                      height: 1,
                      color: Colors.white.withValues(alpha: 0.14),
                    ),
                    const SizedBox(height: 21),
                    Row(
                      children: [
                        if (attendance.isLoading) ...[
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Skeleton(width: 40, height: 14),
                              SizedBox(height: 5),
                              Skeleton(width: 80, height: 22),
                            ],
                          ),
                          Container(
                            width: 1,
                            height: 30,
                            color: Colors.white.withValues(alpha: 0.18),
                            margin: const EdgeInsets.symmetric(horizontal: 24),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Skeleton(width: 50, height: 14),
                              SizedBox(height: 5),
                              Skeleton(width: 90, height: 22),
                            ],
                          ),
                        ] else ...[
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "SCHEDULE",
                                style: TextStyle(
                                  color: Color(0xFF9FACBF),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.7,
                                ),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                attendance.attendanceStartTime,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            width: 1,
                            height: 30,
                            color: Colors.white.withValues(alpha: 0.18),
                            margin: const EdgeInsets.symmetric(horizontal: 24),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "WORKED",
                                style: TextStyle(
                                  color: Color(0xFF9FACBF),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.7,
                                ),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                worked,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              if (attendance.isLoading)
                const Skeleton(
                  height: 54,
                  borderRadius: BorderRadius.all(Radius.circular(18)),
                )
              else if (!isCheckedOut && !isOnLeave)
                PrimaryButton(
                  label: action == "enroll"
                      ? "Enroll attendance photo"
                      : action == "check-in"
                      ? "Check in securely"
                      : "Check out securely",
                  icon: action == "enroll"
                      ? Icons.face_retouching_natural
                      : Icons.face,
                  onPressed: () {
                    Navigator.pushNamed(
                      context,
                      '/verify',
                      arguments: {'mode': action},
                    );
                  },
                )
              else if (isOnLeave)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  height: 54,
                  decoration: BoxDecoration(
                    color: AppPalette.blueSoft,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(
                        Icons.event_available,
                        color: AppPalette.blue,
                        size: 22,
                      ),
                      SizedBox(width: 10),
                      Text(
                        "Approved leave today.",
                        style: TextStyle(
                          color: AppPalette.blue,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  height: 54,
                  decoration: BoxDecoration(
                    color: AppPalette.mintSoft,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(
                        Icons.check_circle,
                        color: AppPalette.mint,
                        size: 22,
                      ),
                      SizedBox(width: 10),
                      Text(
                        "Your attendance has been recorded.",
                        style: TextStyle(
                          color: AppPalette.mint,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              if (attendance.canManageTeam) ...[
                const SizedBox(height: 28),
                _leaveOverviewCard(attendance),
              ],
              const SizedBox(height: 18),
              // More sections can be added...
            ],
          ),
        ),
      ),
    );
  }
}
