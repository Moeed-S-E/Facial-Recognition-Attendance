import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'providers/attendance_provider.dart';
import 'theme/app_theme.dart';
import 'screens/access_denied_screen.dart';
import 'screens/home_screen.dart';
import 'screens/history_screen.dart';
import 'screens/leave_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/manager_screen.dart';
import 'screens/verify_screen.dart';
import 'screens/exception_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/permission_onboarding_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => AttendanceProvider()),
      ],
      child: const SecureAttendanceApp(),
    ),
  );
}

class SecureAttendanceApp extends StatelessWidget {
  const SecureAttendanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Facial Recognition Attendance',
      theme: AppTheme.lightTheme,
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/login': (context) => const LoginScreen(),
        '/permissions': (context) {
          final auth = context.read<AuthProvider>();
          return PermissionOnboardingScreen(
            nextRoute: auth.isAuthenticated ? '/main' : '/login',
          );
        },
        '/main': (context) => const MobileOrganizationGate(),
        '/verify': (context) {
          final args =
              ModalRoute.of(context)?.settings.arguments
                  as Map<String, dynamic>?;
          return VerifyScreen(mode: args?['mode'] ?? 'check-in');
        },
        '/exceptions': (context) {
          final args =
              ModalRoute.of(context)?.settings.arguments
                  as Map<String, dynamic>?;
          return ExceptionScreen(data: args);
        },
      },
    );
  }
}

class MobileOrganizationGate extends StatelessWidget {
  const MobileOrganizationGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final provider = context.watch<AttendanceProvider>();
    if (!auth.isAuthenticated) {
      return const LoginScreen();
    }
    if (provider.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppPalette.blue)),
      );
    }
    if (!provider.mobileAccessAllowed) {
      return const MobileAccessDeniedScreen();
    }
    return const MainLayout();
  }
}

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _selectedIndex = 0;

  List<Widget> _screensFor(AttendanceProvider provider) {
    return [
      const HomeScreen(),
      const HistoryScreen(),
      const LeaveScreen(),
      const ProfileScreen(),
      if (provider.canManageTeam) const ManagerScreen(),
    ];
  }

  List<BottomNavigationBarItem> _itemsFor(AttendanceProvider provider) {
    return [
      const BottomNavigationBarItem(
        icon: Icon(Icons.home_filled),
        label: 'Home',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.history),
        label: 'History',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.calendar_today),
        label: 'Leave',
      ),
      const BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
      if (provider.canManageTeam)
        const BottomNavigationBarItem(
          icon: Icon(Icons.people),
          label: 'Manager',
        ),
    ];
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AttendanceProvider>();
    final screens = _screensFor(provider);
    final items = _itemsFor(provider);
    if (_selectedIndex >= screens.length) {
      _selectedIndex = 0;
    }

    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, animation) => FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0.02, 0),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        ),
        child: KeyedSubtree(
          key: ValueKey(_selectedIndex),
          child: screens.elementAt(_selectedIndex),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        destinations: items
            .map(
              (item) => NavigationDestination(
                icon: item.icon,
                selectedIcon: item.activeIcon,
                label: item.label ?? '',
              ),
            )
            .toList(),
        onDestinationSelected: _onItemTapped,
      ),
    );
  }
}
