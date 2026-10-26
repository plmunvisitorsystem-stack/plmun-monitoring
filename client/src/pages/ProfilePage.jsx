/**
 * Profile page for every role:
 *   resident       -> /profile        (bottom navigation)
 *   response_team  -> /team/profile   (sidebar)
 *   lgu            -> /admin/profile  (sidebar)
 * Shows the username (read-only), the role's own fields with a Save button,
 * a Change Password section (needs the current password), and Log Out.
 */
import { useEffect, useRef, useState } from 'react';
import ResidentLayout from '../layouts/ResidentLayout';
import StaffLayout from '../layouts/StaffLayout';
import Card from '../components/Card';
import Input from '../components/Input';
import PasswordInput from '../components/PasswordInput';
import Button from '../components/Button';
import Alert from '../components/Alert';
import LoadError from '../components/LoadError';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { useLanguage } from '../i18n/useLanguage';
import { useApiData } from '../hooks/useApiData';
import { PROFILE_FIELDS, validatePasswordChange, validateProfile } from '../utils/validation';
import './Profile.css';

// Translation key for each field's label.
const FIELD_LABELS = {
  name: 'auth.name',
  address: 'auth.address',
  contactInfo: 'auth.contactInfo',
  teamName: 'profile.teamName',
  assignedArea: 'profile.assignedArea',
  departmentName: 'profile.departmentName',
  officerInCharge: 'profile.officerInCharge',
};

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function ProfilePage() {
  const { t } = useLanguage();
  const { user, logout, updateUser, replaceToken } = useAuth();
  const role = user.role;
  const fields = PROFILE_FIELDS[role];
  const { data, loading, errorCode, reload } = useApiData('/profile');

  // ----- Profile details form -----
  const [form, setForm] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveStatus, setSaveStatus] = useState(null); // 'saved' or an error code
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // ----- Change password form -----
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordStatus, setPasswordStatus] = useState(null); // 'changed' or an error code
  const [changing, setChanging] = useState(false);
  const changingRef = useRef(false);

  // Fill the form once the profile has loaded.
  useEffect(() => {
    if (data?.profile) {
      const initial = {};
      for (const { name } of fields) initial[name] = data.profile[name] || '';
      setForm(initial);
    }
  }, [data, fields]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setSaveStatus(null);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (savingRef.current) return;
    setSaveStatus(null);

    const errors = validateProfile(role, form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveStatus('VALIDATION_FAILED');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const result = await apiRequest('/profile', { method: 'PUT', body: form });
      const saved = {};
      for (const { name } of fields) saved[name] = result.profile[name] || '';
      setForm(saved);
      updateUser(result.user); // e.g. the greeting uses the new name
      setSaveStatus('saved');
    } catch (error) {
      setFieldErrors(error.fields || {});
      setSaveStatus(error.code);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswords((current) => ({ ...current, [name]: value }));
    setPasswordErrors((current) => ({ ...current, [name]: undefined }));
    setPasswordStatus(null);
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    if (changingRef.current) return;
    setPasswordStatus(null);

    const errors = validatePasswordChange(passwords);
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    changingRef.current = true;
    setChanging(true);
    try {
      const result = await apiRequest('/profile/password', { method: 'PUT', body: passwords });
      // The server ended all older sessions; keep this one with the new token.
      if (result.token) replaceToken(result.token);
      setPasswords(EMPTY_PASSWORDS);
      setPasswordStatus('changed');
    } catch (error) {
      setPasswordErrors(error.fields || {});
      setPasswordStatus(error.code);
    } finally {
      changingRef.current = false;
      setChanging(false);
    }
  }

  const errorText = (errors, name) => (errors[name] ? t(`errors.${errors[name]}`) : undefined);

  const content = (
    <div className="profile">
      <h1 className="page-title">{t('nav.profile')}</h1>

      {loading && <p className="text-muted" role="status">{t('common.loading')}</p>}
      {!loading && errorCode && <LoadError code={errorCode} onRetry={reload} />}

      {!loading && data && form && (
        <>
          {/* Account: username and role, not editable */}
          <Card title={t('profile.accountTitle')}>
            <dl className="profile__account">
              <div>
                <dt>{t('auth.username')}</dt>
                <dd>{data.profile.username}</dd>
              </div>
              <div>
                <dt>{t('profile.accountType')}</dt>
                <dd>{t(`profile.roles.${role}`)}</dd>
              </div>
            </dl>
            <p className="text-muted profile__note">{t('profile.usernameNote')}</p>
          </Card>

          {/* Role-specific details */}
          <Card title={t('profile.detailsTitle')}>
            <form className="profile__form" onSubmit={handleSave} noValidate>
              {saveStatus === 'saved' && <Alert type="success">{t('profile.saved')}</Alert>}
              {saveStatus && saveStatus !== 'saved' && <Alert type="error">{t(`errors.${saveStatus}`)}</Alert>}

              {fields.map(({ name, max }) => (
                <Input
                  key={name}
                  label={t(FIELD_LABELS[name])}
                  hint={name === 'contactInfo' ? t('auth.contactHint') : undefined}
                  name={name}
                  type={name === 'contactInfo' ? 'tel' : 'text'}
                  maxLength={max}
                  value={form[name]}
                  onChange={handleChange}
                  error={errorText(fieldErrors, name)}
                />
              ))}

              <Button type="submit" fullWidth disabled={saving}>
                {saving ? t('profile.saving') : t('profile.save')}
              </Button>
            </form>
          </Card>

          {/* Change password */}
          <Card title={t('profile.passwordTitle')}>
            <form className="profile__form" onSubmit={handlePasswordSubmit} noValidate>
              {passwordStatus === 'changed' && <Alert type="success">{t('profile.passwordChanged')}</Alert>}
              {passwordStatus && passwordStatus !== 'changed' && passwordStatus !== 'VALIDATION_FAILED' && (
                <Alert type="error">{t(`errors.${passwordStatus}`)}</Alert>
              )}

              <PasswordInput
                label={t('profile.currentPassword')}
                name="currentPassword"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={handlePasswordChange}
                error={errorText(passwordErrors, 'currentPassword')}
              />
              <PasswordInput
                label={t('profile.newPassword')}
                hint={t('auth.passwordHint')}
                name="newPassword"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={handlePasswordChange}
                error={errorText(passwordErrors, 'newPassword')}
              />
              <PasswordInput
                label={t('profile.confirmNewPassword')}
                name="confirmPassword"
                autoComplete="new-password"
                value={passwords.confirmPassword}
                onChange={handlePasswordChange}
                error={errorText(passwordErrors, 'confirmPassword')}
              />

              <Button type="submit" variant="secondary" fullWidth disabled={changing}>
                {changing ? t('profile.changing') : t('profile.changePassword')}
              </Button>
            </form>
          </Card>

          <Button variant="outline" icon="logout" fullWidth onClick={() => logout()}>
            {t('nav.logOut')}
          </Button>
        </>
      )}
    </div>
  );

  if (role === 'resident') {
    return <ResidentLayout>{content}</ResidentLayout>;
  }
  return (
    <StaffLayout role={role}>
      <div className="profile--staff">{content}</div>
    </StaffLayout>
  );
}
