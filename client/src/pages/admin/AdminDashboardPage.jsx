/**
 * LGU / Administrator dashboard (/admin/dashboard): all reports.
 */
import StaffLayout from '../../layouts/StaffLayout';
import DashboardView from '../../components/dashboard/DashboardView';

export default function AdminDashboardPage() {
  return (
    <StaffLayout role="lgu">
      <DashboardView role="lgu" />
    </StaffLayout>
  );
}
