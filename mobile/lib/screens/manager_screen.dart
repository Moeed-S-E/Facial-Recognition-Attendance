import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';
import '../providers/attendance_provider.dart';

class ManagerScreen extends StatefulWidget {
  const ManagerScreen({super.key});

  @override
  State<ManagerScreen> createState() => _ManagerScreenState();
}

class _ManagerScreenState extends State<ManagerScreen> {
  static const _scheduleOptions = [
    '06:00',
    '06:30',
    '07:00',
    '07:30',
    '08:00',
    '08:30',
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '12:00',
  ];
  String? _selectedStartTime;
  String? _scheduleFeedback;
  bool _savingSchedule = false;
  final Set<String> _reviewingIds = <String>{};

  String _statusTone(String status) {
    if (status == "Late") return "amber";
    if (status == "On leave") return "blue";
    if (status == "Declined" || status == "rejected") return "rose";
    if (status == "Open" || status == "open") return "rose";
    if (status == "Acknowledged" || status == "acknowledged") return "amber";
    if (status == "Resolved" || status == "resolved") return "mint";
    return "mint";
  }

  String _formatTime(int minutes) {
    return '${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';
  }

  Widget _attendanceSchedule(AttendanceProvider attendance) {
    final currentTime = _formatTime(attendance.attendanceStartMinutes);
    final selectedTime = _selectedStartTime ?? currentTime;
    final canSave = !_savingSchedule && selectedTime != currentTime;
    return FrostedCard(
      padding: const EdgeInsets.all(17),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppPalette.blueSoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.schedule,
                  size: 20,
                  color: AppPalette.blue,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Attendance schedule',
                      style: TextStyle(
                        color: AppPalette.ink,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Late status starts after this time in Pakistan Standard Time.',
                      style: TextStyle(
                        color: AppPalette.muted,
                        fontSize: 12,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 46,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: AppPalette.canvas,
                    border: Border.all(color: AppPalette.line),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _scheduleOptions.contains(selectedTime)
                          ? selectedTime
                          : _scheduleOptions[6],
                      isExpanded: true,
                      icon: const Icon(
                        Icons.expand_more,
                        color: AppPalette.muted,
                      ),
                      style: const TextStyle(
                        color: AppPalette.ink,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                      items: _scheduleOptions
                          .map(
                            (time) => DropdownMenuItem(
                              value: time,
                              child: Text('$time PKT'),
                            ),
                          )
                          .toList(),
                      onChanged: _savingSchedule
                          ? null
                          : (value) => setState(() {
                              _selectedStartTime = value;
                              _scheduleFeedback = null;
                            }),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              InkWell(
                onTap: canSave
                    ? () async {
                        setState(() {
                          _savingSchedule = true;
                          _scheduleFeedback = null;
                        });
                        final error = await attendance.updateAttendancePolicy(
                          selectedTime,
                        );
                        if (!mounted) return;
                        setState(() {
                          _savingSchedule = false;
                          _scheduleFeedback =
                              error ?? 'Attendance start time updated.';
                          if (error == null) _selectedStartTime = null;
                        });
                      }
                    : null,
                borderRadius: BorderRadius.circular(14),
                child: Opacity(
                  opacity: canSave ? 1 : 0.45,
                  child: Container(
                    height: 46,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppPalette.ink,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text(
                      _savingSchedule ? 'Saving…' : 'Save',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (_scheduleFeedback != null)
            Padding(
              padding: const EdgeInsets.only(top: 9),
              child: Text(
                _scheduleFeedback!,
                style: TextStyle(
                  color: _scheduleFeedback == 'Attendance start time updated.'
                      ? AppPalette.mint
                      : AppPalette.rose,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _reviewTeamRequest(
    AttendanceProvider attendance,
    TeamAssignmentRequest request,
    String status,
  ) async {
    if (_reviewingIds.contains(request.id)) return;
    setState(() => _reviewingIds.add(request.id));
    final success = await attendance.reviewTeamAssignment(request.id, status);
    if (!mounted) return;
    setState(() => _reviewingIds.remove(request.id));
    if (!success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to update the team request.')),
      );
    }
  }

  Future<void> _reviewException(
    AttendanceProvider attendance,
    AttendanceExceptionItem exception,
    String status,
  ) async {
    if (_reviewingIds.contains(exception.id)) return;
    setState(() => _reviewingIds.add(exception.id));
    final success = await attendance.reviewAttendanceException(
      exception.id,
      status,
    );
    if (!mounted) return;
    setState(() => _reviewingIds.remove(exception.id));
    if (!success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to update the attendance exception.'),
        ),
      );
    }
  }

  Widget _teamRequests(AttendanceProvider attendance) {
    final pending = attendance.teamAssignmentRequests
        .where((item) => item.status == 'Pending')
        .length;
    return _managementSection(
      icon: Icons.group_add_outlined,
      title: 'Team requests',
      subtitle: pending == 0
          ? 'No pending requests'
          : '$pending awaiting review',
      count: pending,
      children: attendance.teamAssignmentRequests.isEmpty
          ? [
              const _EmptyManagementCard(
                label: 'Team assignment requests will appear here.',
              ),
            ]
          : attendance.teamAssignmentRequests.map((request) {
              final busy = _reviewingIds.contains(request.id);
              final canReview =
                  attendance.canManageLeavePolicy &&
                  request.status == 'Pending';
              return FrostedCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            request.employeeName,
                            style: const TextStyle(
                              color: AppPalette.ink,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        StatusPill(
                          label: request.status,
                          tone: _statusTone(request.status),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${request.employeeEmail} · ${request.teamName}',
                      style: const TextStyle(
                        color: AppPalette.muted,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Requested by ${request.requestedByName}',
                      style: const TextStyle(
                        color: AppPalette.muted,
                        fontSize: 11,
                      ),
                    ),
                    if (canReview) ...[
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: _reviewButton(
                              label: 'Reject',
                              color: AppPalette.roseSoft,
                              textColor: AppPalette.rose,
                              busy: busy,
                              onTap: () => _reviewTeamRequest(
                                attendance,
                                request,
                                'Declined',
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _reviewButton(
                              label: 'Approve',
                              color: AppPalette.mint,
                              textColor: Colors.white,
                              busy: busy,
                              onTap: () => _reviewTeamRequest(
                                attendance,
                                request,
                                'Approved',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              );
            }).toList(),
    );
  }

  Widget _exceptions(AttendanceProvider attendance) {
    final open = attendance.attendanceExceptions
        .where((item) => item.status != 'resolved')
        .length;
    return _managementSection(
      icon: Icons.rule_folder_outlined,
      title: 'Attendance exceptions',
      subtitle: open == 0 ? 'No open exceptions' : '$open need attention',
      count: open,
      children: attendance.attendanceExceptions.isEmpty
          ? [
              const _EmptyManagementCard(
                label: 'Attendance exceptions will appear here.',
              ),
            ]
          : attendance.attendanceExceptions.map((exception) {
              final busy = _reviewingIds.contains(exception.id);
              final canReview = exception.status != 'resolved';
              return FrostedCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            exception.title,
                            style: const TextStyle(
                              color: AppPalette.ink,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        StatusPill(
                          label: _labelFor(exception.status),
                          tone: _statusTone(exception.status),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${exception.subjectUserName} · ${_labelFor(exception.exceptionType)}',
                      style: const TextStyle(
                        color: AppPalette.muted,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      exception.message,
                      style: const TextStyle(
                        color: AppPalette.muted,
                        fontSize: 12,
                        height: 1.35,
                      ),
                    ),
                    if (canReview) ...[
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          if (exception.status == 'open')
                            Expanded(
                              child: _reviewButton(
                                label: 'Acknowledge',
                                color: AppPalette.amber.withValues(alpha: 0.18),
                                textColor: AppPalette.amber,
                                busy: busy,
                                onTap: () => _reviewException(
                                  attendance,
                                  exception,
                                  'acknowledged',
                                ),
                              ),
                            ),
                          if (exception.status == 'open')
                            const SizedBox(width: 10),
                          Expanded(
                            child: _reviewButton(
                              label: 'Resolve',
                              color: AppPalette.ink,
                              textColor: Colors.white,
                              busy: busy,
                              onTap: () => _reviewException(
                                attendance,
                                exception,
                                'resolved',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              );
            }).toList(),
    );
  }

  Widget _managementSection({
    required IconData icon,
    required String title,
    required String subtitle,
    required int count,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(icon, size: 20, color: AppPalette.blue),
                      const SizedBox(width: 8),
                      Text(
                        title,
                        style: const TextStyle(
                          color: AppPalette.ink,
                          fontSize: 19,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: AppPalette.muted,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            if (count > 0) StatusPill(label: '$count', tone: 'rose'),
          ],
        ),
        const SizedBox(height: 12),
        ...children.map(
          (child) =>
              Padding(padding: const EdgeInsets.only(bottom: 12), child: child),
        ),
      ],
    );
  }

  Widget _reviewButton({
    required String label,
    required Color color,
    required Color textColor,
    required bool busy,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: busy ? null : onTap,
      borderRadius: BorderRadius.circular(14),
      child: Opacity(
        opacity: busy ? 0.5 : 1,
        child: Container(
          height: 42,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(14),
          ),
          child: busy
              ? SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: textColor,
                  ),
                )
              : Text(
                  label,
                  style: TextStyle(
                    color: textColor,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
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

  @override
  Widget build(BuildContext context) {
    final attendance = context.watch<AttendanceProvider>();
    final pendingRequests = attendance.managerLeaveRequests
        .where((r) => r.status == "Pending")
        .toList();
    final teamAttendance = attendance.teamAttendance;
    final isManager =
        attendance.currentAccount.role == MobileAccountRole.manager;
    final workspaceEyebrow = isManager
        ? "Manager workspace"
        : "Organization workspace";
    final workspaceTitle = isManager ? "Your team" : "People";

    final presentCount = teamAttendance
        .where((m) => m.status == "Present" || m.status == "Checked out")
        .length;
    final lateCount = teamAttendance.where((m) => m.status == "Late").length;
    final leaveCount = teamAttendance
        .where((m) => m.status == "On leave")
        .length;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          children: [
            PageTitle(
              eyebrow: workspaceEyebrow,
              title: workspaceTitle,
              action: const StatusPill(label: "Live team", tone: "blue"),
            ),
            const SizedBox(height: 24),
            FrostedCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              "TODAY’S COVERAGE",
                              style: TextStyle(
                                color: AppPalette.muted,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.7,
                              ),
                            ),
                            const SizedBox(height: 6),
                            if (attendance.isLoading) ...[
                              const Skeleton(width: 180, height: 26),
                              const SizedBox(height: 5),
                              const Skeleton(width: 220, height: 18),
                            ] else ...[
                              Text(
                                "$presentCount team members active",
                                style: const TextStyle(
                                  color: AppPalette.ink,
                                  fontSize: 21,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -0.4,
                                ),
                              ),
                              const SizedBox(height: 5),
                              const Text(
                                "Review local attendance and leave decisions below.",
                                style: TextStyle(
                                  color: AppPalette.muted,
                                  fontSize: 13,
                                  height: 1.38,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      Container(
                        width: 52,
                        height: 52,
                        margin: const EdgeInsets.only(left: 12),
                        decoration: BoxDecoration(
                          color: AppPalette.blueSoft,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(
                          Icons.people,
                          size: 24,
                          color: AppPalette.blue,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    margin: const EdgeInsets.only(top: 18),
                    padding: const EdgeInsets.only(top: 16),
                    decoration: const BoxDecoration(
                      border: Border(top: BorderSide(color: AppPalette.line)),
                    ),
                    child: attendance.isLoading
                        ? Row(
                            children: const [
                              Skeleton(width: 60, height: 14),
                              SizedBox(width: 22),
                              Skeleton(width: 50, height: 14),
                              SizedBox(width: 22),
                              Skeleton(width: 70, height: 14),
                            ],
                          )
                        : Row(
                            children: [
                              _buildMetric(
                                "Present",
                                presentCount,
                                AppPalette.mint,
                              ),
                              const SizedBox(width: 22),
                              _buildMetric("Late", lateCount, AppPalette.amber),
                              const SizedBox(width: 22),
                              _buildMetric(
                                "On leave",
                                leaveCount,
                                AppPalette.blue,
                              ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
            if (attendance.canManageTeam) ...[
              const SizedBox(height: 16),
              _attendanceSchedule(attendance),
            ],
            if (attendance.canManageTeam) ...[
              const SizedBox(height: 12),
              _teamRequests(attendance),
              const SizedBox(height: 8),
              _exceptions(attendance),
            ],
            const SizedBox(height: 28),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "Leave approvals",
                      style: TextStyle(
                        color: AppPalette.ink,
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      pendingRequests.isNotEmpty
                          ? "${pendingRequests.length} awaiting your review"
                          : "All caught up",
                      style: const TextStyle(
                        color: AppPalette.muted,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                if (attendance.isLoading)
                  const Skeleton(
                    width: 40,
                    height: 28,
                    borderRadius: BorderRadius.all(Radius.circular(14)),
                  )
                else
                  Container(
                    constraints: const BoxConstraints(minWidth: 28),
                    height: 28,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      color: AppPalette.roseSoft,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      "${pendingRequests.length}",
                      style: const TextStyle(
                        color: AppPalette.rose,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (attendance.isLoading)
              ...List.generate(
                2,
                (index) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: FrostedCard(
                    padding: const EdgeInsets.all(17),
                    child: Column(
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Skeleton(
                              width: 42,
                              height: 42,
                              borderRadius: BorderRadius.all(
                                Radius.circular(16),
                              ),
                              margin: EdgeInsets.only(right: 11),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: const [
                                  Skeleton(width: 100, height: 16),
                                  SizedBox(height: 5),
                                  Skeleton(width: 160, height: 14),
                                  SizedBox(height: 5),
                                  Skeleton(width: 80, height: 12),
                                ],
                              ),
                            ),
                            const Skeleton(
                              width: 60,
                              height: 24,
                              borderRadius: BorderRadius.all(
                                Radius.circular(12),
                              ),
                            ),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: Row(
                            children: const [
                              Expanded(
                                child: Skeleton(
                                  height: 42,
                                  borderRadius: BorderRadius.all(
                                    Radius.circular(14),
                                  ),
                                ),
                              ),
                              SizedBox(width: 10),
                              Expanded(
                                child: Skeleton(
                                  height: 42,
                                  borderRadius: BorderRadius.all(
                                    Radius.circular(14),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              ...attendance.managerLeaveRequests.map((request) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: FrostedCard(
                    padding: const EdgeInsets.all(17),
                    child: Column(
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              margin: const EdgeInsets.only(right: 11),
                              decoration: BoxDecoration(
                                color: AppPalette.blueSoft,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                request.initials,
                                style: const TextStyle(
                                  color: AppPalette.blue,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    request.employee,
                                    style: const TextStyle(
                                      color: AppPalette.ink,
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    "${request.type} · ${request.dates}",
                                    style: const TextStyle(
                                      color: AppPalette.muted,
                                      fontSize: 12,
                                      height: 1.4,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    "Submitted ${request.submitted}",
                                    style: const TextStyle(
                                      color: AppPalette.muted,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            StatusPill(
                              label: request.status,
                              tone: _statusTone(request.status),
                            ),
                          ],
                        ),
                        if (request.status == "Pending")
                          Padding(
                            padding: const EdgeInsets.only(top: 16),
                            child: Row(
                              children: [
                                Expanded(
                                  child: InkWell(
                                    onTap: () => attendance.reviewManagerLeave(
                                      request.id,
                                      "Declined",
                                    ),
                                    borderRadius: BorderRadius.circular(14),
                                    child: Container(
                                      height: 42,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color: AppPalette.roseSoft,
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                      child: const Text(
                                        "Decline",
                                        style: TextStyle(
                                          color: AppPalette.rose,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: InkWell(
                                    onTap: () => attendance.reviewManagerLeave(
                                      request.id,
                                      "Approved",
                                    ),
                                    borderRadius: BorderRadius.circular(14),
                                    child: Container(
                                      height: 42,
                                      decoration: BoxDecoration(
                                        color: AppPalette.mint,
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: const [
                                          Icon(
                                            Icons.check,
                                            size: 16,
                                            color: Colors.white,
                                          ),
                                          SizedBox(width: 6),
                                          Text(
                                            "Approve",
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 14,
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
                      ],
                    ),
                  ),
                );
              }),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      "Team attendance",
                      style: TextStyle(
                        color: AppPalette.ink,
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      "Today · Local sample records",
                      style: TextStyle(color: AppPalette.muted, fontSize: 13),
                    ),
                  ],
                ),
                const Icon(Icons.bar_chart, size: 20, color: AppPalette.blue),
              ],
            ),
            const SizedBox(height: 12),
            FrostedCard(
              padding: const EdgeInsets.all(4),
              child: Column(
                children: attendance.isLoading
                    ? List.generate(
                        4,
                        (index) => Container(
                          padding: const EdgeInsets.all(13),
                          decoration: BoxDecoration(
                            border: index == 3
                                ? null
                                : const Border(
                                    bottom: BorderSide(color: AppPalette.line),
                                  ),
                          ),
                          child: Row(
                            children: [
                              const Skeleton(
                                width: 38,
                                height: 38,
                                borderRadius: BorderRadius.all(
                                  Radius.circular(14),
                                ),
                                margin: EdgeInsets.only(right: 10),
                              ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: const [
                                    Skeleton(width: 120, height: 14),
                                    SizedBox(height: 5),
                                    Skeleton(width: 90, height: 12),
                                  ],
                                ),
                              ),
                              const Skeleton(
                                width: 60,
                                height: 24,
                                borderRadius: BorderRadius.all(
                                  Radius.circular(12),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : teamAttendance.asMap().entries.map((entry) {
                        final index = entry.key;
                        final member = entry.value;
                        final isLast = index == teamAttendance.length - 1;

                        return Container(
                          padding: const EdgeInsets.all(13),
                          decoration: BoxDecoration(
                            border: isLast
                                ? null
                                : const Border(
                                    bottom: BorderSide(color: AppPalette.line),
                                  ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 38,
                                height: 38,
                                margin: const EdgeInsets.only(right: 10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F3F8),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  member.initials,
                                  style: const TextStyle(
                                    color: AppPalette.ink,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      member.name,
                                      style: const TextStyle(
                                        color: AppPalette.ink,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      member.detail,
                                      style: const TextStyle(
                                        color: AppPalette.muted,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              StatusPill(
                                label: member.status,
                                tone: _statusTone(member.status),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetric(String label, int value, Color color) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          "$value",
          style: const TextStyle(
            color: AppPalette.ink,
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(color: AppPalette.muted, fontSize: 12),
        ),
      ],
    );
  }
}

class _EmptyManagementCard extends StatelessWidget {
  final String label;

  const _EmptyManagementCard({required this.label});

  @override
  Widget build(BuildContext context) {
    return FrostedCard(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          const Icon(Icons.inbox_outlined, size: 20, color: AppPalette.muted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppPalette.muted,
                fontSize: 13,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
