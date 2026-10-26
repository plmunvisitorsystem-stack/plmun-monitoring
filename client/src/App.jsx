// Root component: decides which page to show for each URL,
// and which roles may open each page.
// Pages are loaded only when first opened (React.lazy), so a resident's phone
// never downloads the LGU / response team pages and charts, and the first
// download stays small.
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, HomeRedirect, ProtectedRoute } from './auth/ProtectedRoute';
import { UnreadCountProvider } from './notifications/UnreadCountContext';
import ChatbotProvider from './chatbot/ChatbotProvider';
import { useLanguage } from './i18n/useLanguage';

// Public
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
// Residents
const HomePage = lazy(() => import('./pages/resident/HomePage'));
const MyReportsPage = lazy(() => import('./pages/resident/MyReportsPage'));
const ReportDetailsPage = lazy(() => import('./pages/resident/ReportDetailsPage'));
const SubmitReportPage = lazy(() => import('./pages/resident/SubmitReportPage'));
const NotificationsPage = lazy(() => import('./pages/resident/NotificationsPage'));
const FeedbackPage = lazy(() => import('./pages/resident/FeedbackPage'));
// Every role
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
// Response teams
const TeamDashboardPage = lazy(() => import('./pages/team/TeamDashboardPage'));
const TeamReportsPage = lazy(() => import('./pages/team/TeamReportsPage'));
const TeamReportDetailsPage = lazy(() => import('./pages/team/TeamReportDetailsPage'));
// Response teams and LGU
const LiveChatPage = lazy(() => import('./pages/staff/LiveChatPage'));
// LGU / Administrator
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const AdminReportDetailsPage = lazy(() => import('./pages/admin/AdminReportDetailsPage'));
const ManageUsersPage = lazy(() => import('./pages/admin/ManageUsersPage'));
const PerformancePage = lazy(() => import('./pages/admin/PerformancePage'));
const GenerateReportsPage = lazy(() => import('./pages/admin/GenerateReportsPage'));
const FeaturedCasesPage = lazy(() => import('./pages/admin/FeaturedCasesPage'));
const ChatSchedulePage = lazy(() => import('./pages/admin/ChatSchedulePage'));
// Development only
const PreviewPage = lazy(() => import('./pages/preview/PreviewPage'));
const PreviewLayoutPage = lazy(() => import('./pages/preview/PreviewLayoutPage'));

// Shown for a moment while a page's code is downloading.
function PageLoading() {
  const { t } = useLanguage();
  return (
    <p className="text-muted page-loading" role="status">
      {t('common.loading')}
    </p>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Only for logged-out visitors (the landing page, Login, Register) */}
        <Route element={<GuestRoute />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Data Privacy Notice: everyone, logged in or not */}
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Residents only */}
        {/* UnreadCountProvider keeps the badge count for the Notifications tab */}
        <Route element={<ProtectedRoute roles={['resident']} />}>
          <Route element={<UnreadCountProvider />}>
            {/* ChatbotProvider adds the floating "Help" button to every resident page */}
            <Route element={<ChatbotProvider />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/report" element={<SubmitReportPage />} />
              <Route path="/reports" element={<MyReportsPage />} />
              <Route path="/reports/:id" element={<ReportDetailsPage />} />
              <Route path="/reports/:id/feedback" element={<FeedbackPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>
        </Route>

        {/* Response teams only. Any other /team/... URL goes to the dashboard for now. */}
        <Route element={<ProtectedRoute roles={['response_team']} />}>
          <Route path="/team/dashboard" element={<TeamDashboardPage />} />
          <Route path="/team/reports" element={<TeamReportsPage />} />
          <Route path="/team/reports/:id" element={<TeamReportDetailsPage />} />
          <Route path="/team/live-chat" element={<LiveChatPage role="response_team" />} />
          <Route path="/team/profile" element={<ProfilePage />} />
          <Route path="/team/*" element={<Navigate to="/team/dashboard" replace />} />
        </Route>

        {/* LGU / Administrator only */}
        <Route element={<ProtectedRoute roles={['lgu']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/users" element={<ManageUsersPage />} />
          <Route path="/admin/performance" element={<PerformancePage />} />
          <Route path="/admin/generate-reports" element={<GenerateReportsPage />} />
          <Route path="/admin/reports/:id" element={<AdminReportDetailsPage />} />
          <Route path="/admin/live-chat" element={<LiveChatPage role="lgu" />} />
          <Route path="/admin/featured-cases" element={<FeaturedCasesPage />} />
          <Route path="/admin/chat-schedule" element={<ChatSchedulePage />} />
          <Route path="/admin/profile" element={<ProfilePage />} />
          <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* TEMPORARY design preview, only while developing (npm run dev) */}
        {import.meta.env.DEV && <Route path="/preview" element={<PreviewPage />} />}
        {import.meta.env.DEV && <Route path="/preview/:layout" element={<PreviewLayoutPage />} />}

        {/* Unknown URLs: home page if logged in, otherwise Login.
            ("/" is the public landing page; logged-in users go to their home page.) */}
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  );
}
