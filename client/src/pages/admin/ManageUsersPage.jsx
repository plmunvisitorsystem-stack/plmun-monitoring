/**
 * LGU "Manage Users" (/admin/users).
 * - Lists residents and response teams with search, Role and Status filters
 *   (kept in the URL so refresh/Back keep them).
 * - "Add User" adds a response team account.
 * - Teams: Edit. Residents: Activate / Deactivate (Deactivate asks first).
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import StaffLayout from '../../layouts/StaffLayout';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import LoadError from '../../components/LoadError';
import TeamFormDialog from './TeamFormDialog';
import { apiRequest } from '../../api/client';
import { useLanguage } from '../../i18n/useLanguage';
import { useApiData } from '../../hooks/useApiData';
import '../../components/ReportTable.css';
import '../team/TeamReports.css';
import './ManageUsers.css';

const FILTER_KEYS = ['search', 'role', 'status'];

function readFilters(searchParams) {
  const filters = {};
  for (const key of FILTER_KEYS) filters[key] = searchParams.get(key) || '';
  return filters;
}

export default function ManageUsersPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState(() => readFilters(searchParams));

  useEffect(() => {
    setDraft(readFilters(searchParams));
  }, [searchParams]);

  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value) query.set(key, value);
  }
  const { data, loading, errorCode, reload } = useApiData(`/admin/users?${query.toString()}`);
  const users = data?.users || [];

  // Which dialog is open: null | { type: 'add' } | { type: 'edit', user } | { type: 'deactivate', user }
  const [dialog, setDialog] = useState(null);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', key, values }
  const [busyId, setBusyId] = useState(null);
  const busyRef = useRef(false);

  function applyFilters(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = draft[key].trim();
      if (value) next.set(key, value);
    }
    setSearchParams(next);
  }

  async function changeStatus(user, status) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(user.id);
    setMessage(null);
    try {
      await apiRequest(`/admin/residents/${user.id}/status`, { method: 'PATCH', body: { status } });
      setMessage({
        type: 'success',
        key: status === 'Inactive' ? 'manageUsers.deactivated' : 'manageUsers.activated',
        values: { name: user.name },
      });
      reload();
    } catch (error) {
      setMessage({ type: 'error', key: `errors.${error.code}` });
    } finally {
      busyRef.current = false;
      setBusyId(null);
      setDialog(null);
    }
  }

  function handleTeamSaved(team) {
    setMessage({
      type: 'success',
      key: dialog.type === 'add' ? 'manageUsers.teamAdded' : 'manageUsers.teamUpdated',
      values: { name: team.teamName },
    });
    setDialog(null);
    reload();
  }

  const roleOptions = [
    { value: '', label: t('manageUsers.allRoles') },
    { value: 'resident', label: t('profile.roles.resident') },
    { value: 'response_team', label: t('profile.roles.response_team') },
  ];
  const statusOptions = [
    { value: '', label: t('teamReports.allStatuses') },
    { value: 'Active', label: t('manageUsers.active') },
    { value: 'Inactive', label: t('manageUsers.inactive') },
  ];

  return (
    <StaffLayout role="lgu">
      <div className="manage-users__heading">
        <h1 className="page-title">{t('nav.manageUsers')}</h1>
        <Button icon="users" onClick={() => setDialog({ type: 'add' })}>
          {t('manageUsers.addUser')}
        </Button>
      </div>

      {/* ----- Search and filters ----- */}
      <Card className="team-filters">
        <form className="user-filters" onSubmit={applyFilters} role="search">
          <Input
            label={t('teamReports.searchLabel')}
            name="search"
            type="search"
            maxLength={100}
            placeholder={t('manageUsers.searchPlaceholder')}
            value={draft.search}
            onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
          />
          <Select
            label={t('manageUsers.role')}
            name="role"
            options={roleOptions}
            value={draft.role}
            onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}
          />
          <Select
            label={t('manageUsers.accountStatus')}
            name="status"
            options={statusOptions}
            value={draft.status}
            onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
          />
          <Button type="submit" icon="list">
            {t('teamReports.filter')}
          </Button>
        </form>
      </Card>

      {message && (
        <div className="manage-users__message">
          <Alert type={message.type}>{t(message.key, message.values)}</Alert>
        </div>
      )}

      {/* ----- Users table ----- */}
      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}
      {!loading && !errorCode && users.length === 0 && (
        <EmptyState icon="users" title={t('manageUsers.emptyTitle')} message={t('teamReports.emptyMessage')} />
      )}

      {!loading && !errorCode && users.length > 0 && (
        <>
          <p className="team-reports__summary" role="status">
            {t('manageUsers.showing', { count: users.length })}
          </p>
          <div className="team-table-wrap">
            <table className="team-table">
              <thead>
                <tr>
                  <th scope="col">{t('manageUsers.name')}</th>
                  <th scope="col">{t('manageUsers.contactInfo')}</th>
                  <th scope="col">{t('manageUsers.role')}</th>
                  <th scope="col">{t('manageUsers.accountStatus')}</th>
                  <th scope="col">{t('teamReports.action')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isResident = user.role === 'resident';
                  const isActive = user.accountStatus === 'Active';
                  return (
                    <tr key={`${user.role}-${user.id}`}>
                      <td data-label={t('manageUsers.name')}>
                        <span className="user-cell__name">{user.name}</span>
                        <span className="user-cell__username">@{user.username}</span>
                      </td>
                      <td data-label={t('manageUsers.contactInfo')}>{user.contactInfo}</td>
                      <td data-label={t('manageUsers.role')}>{t(`profile.roles.${user.role}`)}</td>
                      <td data-label={t('manageUsers.accountStatus')}>
                        {isResident ? (
                          <span className={`account-badge account-badge--${isActive ? 'active' : 'inactive'}`}>
                            {t(isActive ? 'manageUsers.active' : 'manageUsers.inactive')}
                          </span>
                        ) : (
                          // Teams have no account status
                          <span aria-label={t('manageUsers.notApplicable')}>{t('common.none')}</span>
                        )}
                      </td>
                      <td className="user-cell__actions">
                        {isResident ? (
                          isActive ? (
                            <Button
                              variant="outline"
                              className="btn--small btn--outline-danger"
                              disabled={busyId === user.id}
                              onClick={() => setDialog({ type: 'deactivate', user })}
                              aria-label={t('manageUsers.deactivateUser', { name: user.name })}
                            >
                              {t('manageUsers.deactivate')}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              className="btn--small"
                              disabled={busyId === user.id}
                              onClick={() => changeStatus(user, 'Active')}
                              aria-label={t('manageUsers.activateUser', { name: user.name })}
                            >
                              {t('manageUsers.activate')}
                            </Button>
                          )
                        ) : (
                          <Button
                            variant="outline"
                            className="btn--small"
                            icon="pencil"
                            onClick={() => setDialog({ type: 'edit', user })}
                            aria-label={t('manageUsers.editUser', { name: user.name })}
                          >
                            {t('manageUsers.edit')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ----- Dialogs ----- */}
      {(dialog?.type === 'add' || dialog?.type === 'edit') && (
        <TeamFormDialog
          open
          // key: a fresh form each time the dialog opens
          key={dialog.type === 'edit' ? `edit-${dialog.user.id}` : 'add'}
          team={dialog.type === 'edit' ? dialog.user : null}
          onClose={() => setDialog(null)}
          onSaved={handleTeamSaved}
        />
      )}

      <Modal open={dialog?.type === 'deactivate'} title={t('manageUsers.confirmTitle')} onClose={() => setDialog(null)}>
        {dialog?.type === 'deactivate' && (
          <>
            <p className="manage-users__confirm">{t('manageUsers.confirmMessage', { name: dialog.user.name })}</p>
            <div className="modal__actions">
              <Button variant="outline" onClick={() => setDialog(null)}>
                {t('manageUsers.cancel')}
              </Button>
              <Button className="btn--danger" disabled={busyId !== null} onClick={() => changeStatus(dialog.user, 'Inactive')}>
                {t('manageUsers.deactivate')}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </StaffLayout>
  );
}
