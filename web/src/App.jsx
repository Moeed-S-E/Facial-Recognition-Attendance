import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AttendanceProvider } from "./context/AttendanceProvider";
import { NotificationsProvider } from "./context/NotificationContext.jsx";
import Layout from "./components/Layout";
import Home from "./screens/Home";
import History from "./screens/History";
import Leave from "./screens/Leave";
import Profile from "./screens/Profile";
import Manager from "./screens/Manager";
import Verify from "./screens/Verify";
import Landing from "./screens/Landing";
import Login from "./screens/Login";
import Register from "./screens/Register";
import Team from "./screens/Team";
import Insights from "./screens/Insights";
import Exceptions from "./screens/Exceptions";
import { useAuthStore } from "./store/useAuthStore";

function RequireAuth({ children }) {
  const token = useAuthStore((state) => state.token);
  return token ? children : <Navigate to="/login" replace />;
}

function PublicLanding() {
  const token = useAuthStore((state) => state.token);
  return token ? <Navigate to="/app" replace /> : <Landing />;
}

function PublicLogin() {
  const token = useAuthStore((state) => state.token);
  return token ? <Navigate to="/app" replace /> : <Login />;
}

function PublicRegister() {
  const token = useAuthStore((state) => state.token);
  return token ? <Navigate to="/app" replace /> : <Register />;
}

function workspaceRouteElements() {
  return [
    <Route key="overview" index element={<Home />} />,
    <Route key="history" path="history" element={<History />} />,
    <Route key="team" path="team" element={<Team />} />,
    <Route key="insights" path="insights" element={<Insights />} />,
    <Route key="exceptions" path="exceptions" element={<Exceptions />} />,
    <Route key="leave" path="leave" element={<Leave />} />,
    <Route key="profile" path="profile" element={<Profile />} />,
    <Route key="manager" path="manager" element={<Manager />} />,
  ];
}

function App({ initialRole = "enterprise_admin" }) {
  return (
    <AttendanceProvider initialRole={initialRole}>
      <NotificationsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicLanding />} />
            <Route path="/login" element={<PublicLogin />} />
            <Route path="/register" element={<PublicRegister />} />
            <Route path="/app" element={<RequireAuth><Layout /></RequireAuth>}>
              {workspaceRouteElements()}
            </Route>
            <Route path="/demo" element={<Layout demoMode />}>
              {workspaceRouteElements()}
            </Route>
            <Route path="/verify" element={<RequireAuth><Verify /></RequireAuth>} />
            <Route path="*" element={<PublicLanding />} />
          </Routes>
        </BrowserRouter>
      </NotificationsProvider>
    </AttendanceProvider>
  );
}

export default App;
