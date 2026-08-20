import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_time.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';
import '../providers/attendance_provider.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  bool _isComposing = false;
  String _type = "Annual leave";
  DateTime? _startDate;
  DateTime? _endDate;
  String _note = "";
  bool _submitted = false;
  int? _annualDays;
  int? _medicalDays;
  bool _savingPolicy = false;
  String _policyMessage = '';
  String _policyError = '';
  String? _reviewingLeaveId;
  String _reviewError = '';

  final List<String> _leaveTypes = [
    "Annual leave",
    "Medical leave",
    "Personal leave",
  ];

  Future<void> _pickDate(BuildContext context, {required bool start}) async {
    final today = pakistanNow();
    final initial = start
        ? (_startDate ?? today)
        : (_endDate ?? _startDate ?? today);
    final picked = await showDatePicker(
      context: context,
      firstDate: today,
      lastDate: today.add(const Duration(days: 365)),
      initialDate: initial,
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (start) {
        _startDate = picked;
        if (_endDate != null && _endDate!.isBefore(picked)) _endDate = picked;
      } else {
        _endDate = picked;
      }
    });
  }

  Future<void> _savePolicy(BuildContext context) async {
    final attendance = context.read<AttendanceProvider>();
    final annual = _annualDays ?? attendance.annualLeaveDays;
    final medical = _medicalDays ?? attendance.medicalLeaveDays;
    setState(() {
      _savingPolicy = true;
      _policyMessage = '';
      _policyError = '';
    });
    final error = await attendance.updateLeavePolicy(annual, medical);
    if (!mounted) return;
    setState(() {
      _savingPolicy = false;
      if (error == null) {
        _annualDays = annual;
        _medicalDays = medical;
        _policyMessage = 'Leave allowances updated.';
      } else {
        _policyError = error;
      }
    });
  }

  Future<void> _submit(BuildContext context) async {
    if (_startDate == null || _endDate == null) return;
    final ok = await context.read<AttendanceProvider>().submitLeave(
      _type,
      _startDate!.toIso8601String().substring(0, 10),
      _endDate!.toIso8601String().substring(0, 10),
      _note,
    );
    if (!mounted) return;
    setState(() {
      _submitted = ok;
      if (ok) {
        _isComposing = false;
        _note = "";
      }
    });
  }

  Future<void> _reviewLeave(
    BuildContext context,
    ManagerLeaveRequest request,
    String decision,
  ) async {
    setState(() {
      _reviewingLeaveId = request.id;
      _reviewError = '';
    });
    final ok = await context.read<AttendanceProvider>().reviewManagerLeave(
      request.id,
      decision,
    );
    if (!mounted) return;
    setState(() {
      _reviewingLeaveId = null;
      if (!ok) _reviewError = 'Unable to review the leave request.';
    });
  }

  Widget _reviewCard(BuildContext context, ManagerLeaveRequest request) {
    final pending = request.status == 'Pending';
    final busy = _reviewingLeaveId == request.id;
    final statusColor = request.status == 'Approved'
        ? AppPalette.mint
        : request.status == 'Declined'
        ? AppPalette.rose
        : AppPalette.blue;
    return FrostedCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 19,
                backgroundColor: AppPalette.blueSoft,
                child: Text(
                  request.initials,
                  style: const TextStyle(
                    color: AppPalette.blue,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request.employee,
                      style: const TextStyle(
                        color: AppPalette.ink,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${request.type} · ${request.dates}',
                      style: const TextStyle(
                        color: AppPalette.ink,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Submitted ${request.submitted}',
                      style: const TextStyle(
                        color: AppPalette.muted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  request.status,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          if (pending) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: busy
                        ? null
                        : () => _reviewLeave(context, request, 'Declined'),
                    child: const Text('Reject'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: busy
                        ? null
                        : () => _reviewLeave(context, request, 'Approved'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppPalette.ink,
                      foregroundColor: Colors.white,
                    ),
                    child: Text(busy ? 'Saving…' : 'Approve'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final attendance = context.watch<AttendanceProvider>();
    final leaveRequests = attendance.leaveRequests;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          children: [
            PageTitle(
              eyebrow: "Time away",
              title: "Leave",
              action: AppIconButton(
                icon: _isComposing ? Icons.close : Icons.add,
                onPressed: () {
                  setState(() {
                    _isComposing = !_isComposing;
                  });
                },
              ),
            ),
            const SizedBox(height: 24),
            FrostedCard(
              padding: const EdgeInsets.all(20),
              color: AppPalette.ink,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (attendance.isLoading) ...[
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Skeleton(width: 80, height: 14),
                        SizedBox(height: 7),
                        Skeleton(width: 110, height: 35),
                        SizedBox(height: 5),
                        Skeleton(width: 140, height: 16),
                      ],
                    ),
                  ] else ...[
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "ANNUAL LEAVE",
                          style: TextStyle(
                            color: Color(0xFFB9C4D6),
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.8,
                          ),
                        ),
                        SizedBox(height: 7),
                        Text(
                          '${attendance.annualLeaveDays} days',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 30,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.8,
                          ),
                        ),
                        SizedBox(height: 5),
                        Text(
                          "Organization allowance through Dec 31",
                          style: TextStyle(
                            color: Color(0xFFCDD7E7),
                            fontSize: 13,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          "Medical leave · ${attendance.medicalLeaveDays} days",
                          style: TextStyle(
                            color: Color(0xFFB9C4D6),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                  Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      color: AppPalette.blueSoft,
                      borderRadius: BorderRadius.circular(17),
                    ),
                    child: const Icon(
                      Icons.calendar_today,
                      size: 26,
                      color: AppPalette.blue,
                    ),
                  ),
                ],
              ),
            ),
            if (attendance.canManageLeavePolicy)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: FrostedCard(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Leave allowances',
                        style: TextStyle(
                          color: AppPalette.ink,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 5),
                      const Text(
                        'Set the organization-wide annual and medical allowance.',
                        style: TextStyle(color: AppPalette.muted, fontSize: 12),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              initialValue:
                                  '${_annualDays ?? attendance.annualLeaveDays}',
                              keyboardType: TextInputType.number,
                              enabled: !_savingPolicy,
                              decoration: const InputDecoration(
                                labelText: 'Annual days',
                              ),
                              onChanged: (value) =>
                                  _annualDays = int.tryParse(value),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextFormField(
                              initialValue:
                                  '${_medicalDays ?? attendance.medicalLeaveDays}',
                              keyboardType: TextInputType.number,
                              enabled: !_savingPolicy,
                              decoration: const InputDecoration(
                                labelText: 'Medical days',
                              ),
                              onChanged: (value) =>
                                  _medicalDays = int.tryParse(value),
                            ),
                          ),
                        ],
                      ),
                      if (_policyError.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          _policyError,
                          style: const TextStyle(
                            color: AppPalette.rose,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                      if (_policyMessage.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          _policyMessage,
                          style: const TextStyle(
                            color: AppPalette.mint,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),
                      PrimaryButton(
                        label: _savingPolicy ? 'Saving…' : 'Save allowances',
                        icon: Icons.check,
                        onPressed: _savingPolicy
                            ? null
                            : () => _savePolicy(context),
                      ),
                    ],
                  ),
                ),
              ),
            if (attendance.canManageTeam) ...[
              Padding(
                padding: const EdgeInsets.only(top: 18, bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Leave approvals',
                      style: TextStyle(
                        color: AppPalette.ink,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Review requests from your organization or managed team.',
                      style: TextStyle(color: AppPalette.muted, fontSize: 12),
                    ),
                    if (_reviewError.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        _reviewError,
                        style: const TextStyle(
                          color: AppPalette.rose,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (attendance.managerLeaveRequests.isEmpty)
                const Text(
                  'No leave requests to review.',
                  style: TextStyle(color: AppPalette.muted, fontSize: 13),
                )
              else
                ...attendance.managerLeaveRequests.map(
                  (request) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _reviewCard(context, request),
                  ),
                ),
            ],
            if (_submitted)
              Container(
                margin: const EdgeInsets.only(top: 14),
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: AppPalette.mintSoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.check_circle, size: 18, color: AppPalette.mint),
                    SizedBox(width: 8),
                    Text(
                      "Your request is ready for review.",
                      style: TextStyle(
                        color: AppPalette.mint,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            if (_isComposing)
              Padding(
                padding: const EdgeInsets.only(top: 18),
                child: FrostedCard(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        "Request time off",
                        style: TextStyle(
                          color: AppPalette.ink,
                          fontSize: 19,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        "LEAVE TYPE",
                        style: TextStyle(
                          color: AppPalette.muted,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.7,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: _leaveTypes.map((item) {
                          final selected = item == _type;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () {
                                setState(() {
                                  _type = item;
                                });
                              },
                              child: Container(
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                ),
                                height: 42,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: selected
                                      ? AppPalette.blueSoft
                                      : const Color(0xFFF2F4F7),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: selected
                                        ? AppPalette.blue.withValues(
                                            alpha: 0.14,
                                          )
                                        : Colors.transparent,
                                  ),
                                ),
                                child: Text(
                                  item.replaceAll(" leave", ""),
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: selected
                                        ? AppPalette.blue
                                        : AppPalette.muted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        "DATES",
                        style: TextStyle(
                          color: AppPalette.muted,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.7,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _pickDate(context, start: true),
                              icon: const Icon(Icons.calendar_today, size: 16),
                              label: Text(
                                _startDate == null
                                    ? 'Start date'
                                    : _startDate!.toIso8601String().substring(
                                        0,
                                        10,
                                      ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _pickDate(context, start: false),
                              icon: const Icon(Icons.event, size: 16),
                              label: Text(
                                _endDate == null
                                    ? 'End date'
                                    : _endDate!.toIso8601String().substring(
                                        0,
                                        10,
                                      ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        "NOTE · OPTIONAL",
                        style: TextStyle(
                          color: AppPalette.muted,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.7,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        onChanged: (val) => _note = val,
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: "Add a short note",
                          hintStyle: const TextStyle(color: Color(0xFF98A2B3)),
                          filled: true,
                          fillColor: const Color(0xFFF7F8FC),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 13,
                            vertical: 14,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderSide: const BorderSide(
                              color: AppPalette.line,
                            ),
                            borderRadius: BorderRadius.circular(13),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderSide: const BorderSide(
                              color: AppPalette.blue,
                            ),
                            borderRadius: BorderRadius.circular(13),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      PrimaryButton(
                        label: "Send request",
                        icon: Icons.arrow_forward,
                        onPressed: (_startDate == null || _endDate == null)
                            ? null
                            : () => _submit(context),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 28),
            const Text(
              "Your requests",
              style: TextStyle(
                color: AppPalette.ink,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            if (attendance.isLoading)
              ...List.generate(
                2,
                (index) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: FrostedCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            const Skeleton(
                              width: 42,
                              height: 42,
                              borderRadius: BorderRadius.all(
                                Radius.circular(13),
                              ),
                            ),
                            const SizedBox(width: 11),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: const [
                                  Skeleton(width: 100, height: 16),
                                  SizedBox(height: 5),
                                  Skeleton(width: 120, height: 14),
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
                        Container(
                          margin: const EdgeInsets.only(top: 14),
                          padding: const EdgeInsets.only(top: 12),
                          decoration: const BoxDecoration(
                            border: Border(
                              top: BorderSide(color: AppPalette.line),
                            ),
                          ),
                          child: const Skeleton(height: 14),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else if (leaveRequests.isEmpty)
              FrostedCard(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 22,
                ),
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
                        Icons.event_available,
                        size: 19,
                        color: AppPalette.blue,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'No leave requests yet. Use + to request time away.',
                        style: TextStyle(
                          color: AppPalette.muted,
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              )
            else
              ...leaveRequests.map((request) {
                final tone = request.status == "Approved"
                    ? "mint"
                    : request.status == "Declined"
                    ? "rose"
                    : "amber";
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: FrostedCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: AppPalette.blueSoft,
                                borderRadius: BorderRadius.circular(13),
                              ),
                              child: const Icon(
                                Icons.calendar_today,
                                size: 19,
                                color: AppPalette.blue,
                              ),
                            ),
                            const SizedBox(width: 11),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    request.type,
                                    style: const TextStyle(
                                      color: AppPalette.ink,
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    request.dates,
                                    style: const TextStyle(
                                      color: AppPalette.muted,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            StatusPill(label: request.status, tone: tone),
                          ],
                        ),
                        Container(
                          margin: const EdgeInsets.only(top: 14),
                          padding: const EdgeInsets.only(top: 12),
                          decoration: const BoxDecoration(
                            border: Border(
                              top: BorderSide(color: AppPalette.line),
                            ),
                          ),
                          child: Text(
                            request.note,
                            style: const TextStyle(
                              color: AppPalette.muted,
                              fontSize: 13,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
