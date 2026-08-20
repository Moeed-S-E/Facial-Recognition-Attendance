const pakistanTimeOffset = Duration(hours: 5);

DateTime pakistanNow() => DateTime.now().toUtc().add(pakistanTimeOffset);

DateTime parseApiTimestamp(String value) => DateTime.parse(
  value.endsWith('Z') || value.contains('+') ? value : '${value}Z',
).toUtc().add(pakistanTimeOffset);

String pakistanDateKey(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
