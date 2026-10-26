/**
 * Response team dashboard (/team/dashboard):
 * its assigned reports + unassigned reports.
 */
import StaffLayout from '../../layouts/StaffLayout';
import DashboardView from '../../components/dashboard/DashboardView';

export default function TeamDashboardPage() {
  return (
    <StaffLayout role="response_team">
      <DashboardView role="response_team" />
    </StaffLayout>
  );
}
