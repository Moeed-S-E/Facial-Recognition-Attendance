import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../app_time.dart';
import '../theme/app_theme.dart';
import '../widgets/app_ui.dart';
import '../providers/attendance_provider.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  String _statusFilter = 'All';
  String _dateFilter = 'Last 7 days';
  String _exportState = 'idle';

  bool _isWithinDateFilter(String dateStr, String filter) {
    if (filter == 'All dates') return true;
    final today = pakistanNow();
    final entryDate = DateTime.parse('${dateStr}T12:00:00');
    if (filter == 'Today') {
      return entryDate.year == today.year &&
          entryDate.month == today.month &&
          entryDate.day == today.day;
    }
    final threshold = today.subtract(const Duration(days: 6));
    final thresholdStart = DateTime(
      threshold.year,
      threshold.month,
      threshold.day,
    );
    return entryDate.isAfter(thresholdStart) ||
        entryDate.isAtSameMomentAs(thresholdStart);
  }

  void _exportHistory() async {
    setState(() {
      _exportState = 'exporting';
    });
    // Simulate export delay
    await Future.delayed(const Duration(milliseconds: 800));
    setState(() {
      _exportState = 'shared';
    });
  }

  @override
  Widget build(BuildContext context) {
    final attendance = context.watch<AttendanceProvider>();
    final entries = attendance.entries;

    final filteredEntries = entries.where((entry) {
      final statusMatch =
          _statusFilter == 'All' || entry.status == _statusFilter;
      final dateMatch = _isWithinDateFilter(entry.date, _dateFilter);
      return statusMatch && dateMatch;
    }).toList();

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          children: [
            PageTitle(
              eyebrow: "Attendance",
              title: "History",
              action: Material(
                color: AppPalette.blueSoft,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  onTap:
                      (filteredEntries.isEmpty || _exportState == 'exporting')
                      ? null
                      : _exportHistory,
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    height: 42,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_exportState == 'exporting')
                          const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppPalette.blue,
                            ),
                          )
                        else
                          const Icon(
                            Icons.ios_share,
                            size: 16,
                            color: AppPalette.blue,
                          ),
                        const SizedBox(width: 6),
                        const Text(
                          "Export",
                          style: TextStyle(
                            color: AppPalette.blue,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            FrostedCard(
              padding: const EdgeInsets.all(17),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppPalette.blueSoft,
                      borderRadius: BorderRadius.circular(15),
                    ),
                    child: const Icon(
                      Icons.bar_chart,
                      color: AppPalette.blue,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "FILTERED RESULTS",
                          style: TextStyle(
                            color: AppPalette.muted,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.7,
                          ),
                        ),
                        const SizedBox(height: 4),
                        if (attendance.isLoading) ...[
                          const Skeleton(width: 100, height: 22),
                          const SizedBox(height: 5),
                          const Skeleton(width: 160, height: 16),
                        ] else ...[
                          Text(
                            "${filteredEntries.length} record${filteredEntries.length == 1 ? '' : 's'}",
                            style: const TextStyle(
                              color: AppPalette.ink,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            "$_dateFilter · ${_statusFilter == 'All' ? 'All statuses' : _statusFilter}",
                            style: const TextStyle(
                              color: AppPalette.muted,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (_exportState == 'shared')
              const Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text(
                  "Export ready in the device share sheet.",
                  style: TextStyle(
                    color: AppPalette.mint,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            const SizedBox(height: 26),
            Row(
              children: const [
                Icon(Icons.tune, size: 17, color: AppPalette.muted),
                SizedBox(width: 7),
                Text(
                  "Filter history",
                  style: TextStyle(
                    color: AppPalette.ink,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              "DATE",
              style: TextStyle(
                color: AppPalette.muted,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.7,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: ['Last 7 days', 'Today', 'All dates'].map((filter) {
                final selected = _dateFilter == filter;
                return FilterChipWidget(
                  label: filter,
                  selected: selected,
                  onPress: () {
                    setState(() {
                      _dateFilter = filter;
                      _exportState = 'idle';
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            const Text(
              "STATUS",
              style: TextStyle(
                color: AppPalette.muted,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.7,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: ['All', 'Present', 'Late', 'On leave'].map((filter) {
                final selected = _statusFilter == filter;
                return FilterChipWidget(
                  label: filter,
                  selected: selected,
                  onPress: () {
                    setState(() {
                      _statusFilter = filter;
                      _exportState = 'idle';
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 28),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  "Recent activity",
                  style: TextStyle(
                    color: AppPalette.ink,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  "${filteredEntries.length} shown",
                  style: const TextStyle(
                    color: AppPalette.muted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (attendance.isLoading)
              ...List.generate(
                3,
                (index) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: FrostedCard(
                    padding: const EdgeInsets.all(17),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: const [
                                Skeleton(width: 120, height: 18),
                                SizedBox(height: 5),
                                Skeleton(width: 150, height: 14),
                              ],
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
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.only(top: 16.0),
                          decoration: const BoxDecoration(
                            border: Border(
                              top: BorderSide(color: AppPalette.line, width: 1),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: const [
                              Skeleton(width: 80, height: 16),
                              Skeleton(width: 70, height: 16),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else if (filteredEntries.isEmpty)
              FrostedCard(
                padding: const EdgeInsets.all(28),
                child: Column(
                  children: const [
                    Icon(Icons.description, size: 26, color: AppPalette.muted),
                    SizedBox(height: 10),
                    Text(
                      "No records match",
                      style: TextStyle(
                        color: AppPalette.ink,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 5),
                    Text(
                      "Adjust a date or status filter to see more attendance history.",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppPalette.muted,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              )
            else
              ...filteredEntries.map((item) {
                String tone = "mint";
                if (item.status == "Late") tone = "amber";
                if (item.status == "On leave") tone = "blue";

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: FrostedCard(
                    padding: const EdgeInsets.all(17),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.label,
                                  style: const TextStyle(
                                    color: AppPalette.ink,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  "${item.checkIn}  →  ${item.checkOut}",
                                  style: const TextStyle(
                                    color: AppPalette.muted,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                            StatusPill(label: item.status, tone: tone),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.only(top: 16.0),
                          decoration: const BoxDecoration(
                            border: Border(
                              top: BorderSide(color: AppPalette.line, width: 1),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.access_time_filled,
                                    size: 14,
                                    color: AppPalette.muted,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    item.duration,
                                    style: const TextStyle(
                                      color: AppPalette.ink,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                              const Text(
                                "Local record",
                                style: TextStyle(
                                  color: AppPalette.muted,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
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
          ],
        ),
      ),
    );
  }
}

class FilterChipWidget extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onPress;

  const FilterChipWidget({
    super.key,
    required this.label,
    required this.selected,
    required this.onPress,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPress,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppPalette.ink : const Color(0xFFEDF0F5),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : AppPalette.muted,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
