import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';

class OnboardingDialog extends StatefulWidget {
  final bool forceTour;
  const OnboardingDialog({super.key, this.forceTour = false});

  @override
  State<OnboardingDialog> createState() => _OnboardingDialogState();
}

class _OnboardingDialogState extends State<OnboardingDialog> {
  int _step = 1;
  bool _isLoading = false;
  String? _error;

  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _empIdController = TextEditingController();
  final _deptController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _step = widget.forceTour ? 2 : 1;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      _nameController.text = authProvider.userPayload?['name']?.toString() ?? '';
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _empIdController.dispose();
    _deptController.dispose();
    super.dispose();
  }

  Future<void> _submitOnboarding() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    try {
      final response = await http.post(
        Uri.parse('${AuthProvider.baseUrl}/v1/users/onboard'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${authProvider.token}',
        },
        body: json.encode({
          'name': _nameController.text.trim(),
          'employee_id': _empIdController.text.trim(),
          'department': _deptController.text.trim(),
        }),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        await authProvider.updateToken(data['access_token']);
        setState(() => _step = 2);
      } else {
        final error = json.decode(response.body);
        throw Exception(error['detail'] ?? 'Failed to save details');
      }
    } catch (e) {
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Widget _buildStep1(String userId) {
    return Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.person_pin, size: 48, color: AppPalette.blue),
          const SizedBox(height: 16),
          const Text(
            'Welcome aboard!',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppPalette.ink),
          ),
          const SizedBox(height: 8),
          const Text(
            'Let\'s get your profile set up.',
            style: TextStyle(color: AppPalette.muted),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                const Text('YOUR ASSIGNED SYSTEM ID', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppPalette.muted)),
                const SizedBox(height: 4),
                Text(userId, style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppPalette.ink), textAlign: TextAlign.center),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppPalette.rose.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
              child: Text(_error!, style: const TextStyle(color: AppPalette.rose, fontSize: 13)),
            ),

          TextFormField(
            controller: _nameController,
            decoration: const InputDecoration(labelText: 'Legal Name', border: OutlineInputBorder()),
            validator: (val) => val == null || val.isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _empIdController,
            decoration: const InputDecoration(labelText: 'Employee ID', border: OutlineInputBorder()),
            validator: (val) => val == null || val.isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _deptController,
            decoration: const InputDecoration(labelText: 'Department', border: OutlineInputBorder()),
            validator: (val) => val == null || val.isEmpty ? 'Required' : null,
          ),
          const SizedBox(height: 24),
          
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _submitOnboarding,
              style: ElevatedButton.styleFrom(backgroundColor: AppPalette.blue, foregroundColor: Colors.white),
              child: _isLoading 
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Verify & Continue'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep2() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.camera_alt, size: 48, color: AppPalette.mint),
        const SizedBox(height: 16),
        const Text(
          'Secure Check-In',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppPalette.ink),
        ),
        const SizedBox(height: 16),
        const Text(
          'You will use the primary dashboard widget to securely check in and out using Facial Recognition.',
          style: TextStyle(color: AppPalette.muted, height: 1.5),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: () => setState(() => _step = 3),
            style: ElevatedButton.styleFrom(backgroundColor: AppPalette.blue, foregroundColor: Colors.white),
            child: const Text('Next'),
          ),
        ),
      ],
    );
  }

  Widget _buildStep3() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.list_alt, size: 48, color: AppPalette.amber),
        const SizedBox(height: 16),
        const Text(
          'Track Your Activity',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppPalette.ink),
        ),
        const SizedBox(height: 16),
        const Text(
          'Your recent attendance records and hours logged will appear right on the dashboard. It is that simple!',
          style: TextStyle(color: AppPalette.muted, height: 1.5),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: () => Navigator.of(context).pop(), // Closes the dialog
            style: ElevatedButton.styleFrom(backgroundColor: AppPalette.blue, foregroundColor: Colors.white),
            child: const Text('Finish Tour'),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final userId = Provider.of<AuthProvider>(context, listen: false).userPayload?['id']?.toString() ?? 'UNKNOWN_ID';

    return PopScope(
      canPop: false, // Prevent dismissing by tapping outside or back button
      child: Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: _step == 1 
                ? _buildStep1(userId) 
                : _step == 2 
                  ? _buildStep2() 
                  : _buildStep3(),
            ),
          ),
        ),
      ),
    );
  }
}
