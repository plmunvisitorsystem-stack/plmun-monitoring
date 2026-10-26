/**
 * Dialog to add a new response team account, or edit a team's details.
 *   team:    null -> "Add" mode (username + password fields shown)
 *            { id, name, username, contactInfo, details } -> "Edit" mode
 *   onSaved: called with the saved team after the server accepts it
 */
import { useRef, useState } from 'react';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import PasswordInput from '../../components/PasswordInput';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { apiRequest } from '../../api/client';
import { useLanguage } from '../../i18n/useLanguage';
import { validateNewTeam, validateProfile } from '../../utils/validation';

export default function TeamFormDialog({ open, team, onClose, onSaved }) {
  const { t } = useLanguage();
  const isEdit = Boolean(team);

  const [form, setForm] = useState(() => ({
    teamName: team?.name || '',
    assignedArea: team?.details || '',
    contactInfo: team?.contactInfo || '',
    username: '',
    password: '',
    confirmPassword: '',
  }));
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorCode, setErrorCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (savingRef.current) return;
    setErrorCode(null);

    const errors = isEdit ? validateProfile('response_team', form) : validateNewTeam(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setErrorCode('VALIDATION_FAILED');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const details = { teamName: form.teamName, assignedArea: form.assignedArea, contactInfo: form.contactInfo };
      const result = isEdit
        ? await apiRequest(`/admin/teams/${team.id}`, { method: 'PUT', body: details })
        : await apiRequest('/admin/teams', { method: 'POST', body: form });
      onSaved(result.team);
    } catch (error) {
      setFieldErrors(error.fields || {});
      setErrorCode(error.code);
      savingRef.current = false;
      setSaving(false);
    }
  }

  const fieldError = (name) => (fieldErrors[name] ? t(`errors.${fieldErrors[name]}`) : undefined);

  return (
    <Modal open={open} title={t(isEdit ? 'manageUsers.editTeamTitle' : 'manageUsers.addTeamTitle')} onClose={onClose}>
      <form className="user-form" onSubmit={handleSubmit} noValidate>
        {!isEdit && <p className="text-muted">{t('manageUsers.addTeamIntro')}</p>}
        {isEdit && (
          <p className="user-form__username">
            {t('auth.username')}: <strong>{team.username}</strong>
          </p>
        )}
        {errorCode && <Alert type="error">{t(`errors.${errorCode}`)}</Alert>}

        <Input label={t('profile.teamName')} name="teamName" maxLength={100} value={form.teamName} onChange={handleChange} error={fieldError('teamName')} />
        <Input
          label={t('profile.assignedArea')}
          hint={t('manageUsers.assignedAreaHint')}
          name="assignedArea"
          maxLength={255}
          value={form.assignedArea}
          onChange={handleChange}
          error={fieldError('assignedArea')}
        />
        <Input
          label={t('auth.contactInfo')}
          hint={t('auth.contactHint')}
          name="contactInfo"
          type="tel"
          maxLength={20}
          value={form.contactInfo}
          onChange={handleChange}
          error={fieldError('contactInfo')}
        />

        {!isEdit && (
          <>
            <Input
              label={t('auth.username')}
              hint={t('auth.usernameHint')}
              name="username"
              autoComplete="off"
              autoCapitalize="none"
              maxLength={30}
              value={form.username}
              onChange={handleChange}
              error={fieldError('username')}
            />
            <PasswordInput
              label={t('auth.password')}
              hint={t('auth.passwordHint')}
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              error={fieldError('password')}
            />
            <PasswordInput
              label={t('auth.confirmPassword')}
              name="confirmPassword"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              error={fieldError('confirmPassword')}
            />
          </>
        )}

        <div className="modal__actions">
          <Button variant="outline" onClick={onClose}>
            {t('manageUsers.cancel')}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t('profile.saving') : t(isEdit ? 'profile.save' : 'manageUsers.addTeamButton')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
