/**
 * Client-side form checks (instant feedback before calling the API).
 * Same rules and error codes as server/src/utils/validators.js;
 * the server still checks everything again.
 * Each function returns { fieldName: ERROR_CODE } for invalid fields.
 */

import { ISSUE_TYPES } from './constants';

const USERNAME_PATTERN = /^[A-Za-z0-9._]{4,30}$/;
const MOBILE_PATTERN = /^(09\d{9}|\+639\d{9})$/;

function requiredText(value, maxLength) {
  const text = value.trim();
  if (!text) return 'FIELD_REQUIRED';
  if (text.length > maxLength) return 'TOO_LONG';
  return null;
}

// Report limits (same as the server)
export const LOCATION_MIN = 3;
export const LOCATION_MAX = 150;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 1000;

export function validateReport({ issueType, area, location, description }) {
  const errors = {};
  const place = location.trim();
  const text = description.trim();

  if (!ISSUE_TYPES.includes(issueType)) errors.issueType = 'INVALID_ISSUE_TYPE';
  if (!area) errors.area = 'AREA_REQUIRED';

  if (!place) errors.location = 'FIELD_REQUIRED';
  else if (place.length < LOCATION_MIN) errors.location = 'LOCATION_TOO_SHORT';
  else if (place.length > LOCATION_MAX) errors.location = 'LOCATION_TOO_LONG';

  if (!text) errors.description = 'FIELD_REQUIRED';
  else if (text.length < DESCRIPTION_MIN) errors.description = 'DESCRIPTION_TOO_SHORT';
  else if (text.length > DESCRIPTION_MAX) errors.description = 'DESCRIPTION_TOO_LONG';

  return errors;
}

// Profile fields for each role and their maximum length (same as the server).
export const PROFILE_FIELDS = {
  resident: [
    { name: 'name', max: 100 },
    { name: 'address', max: 255 },
    { name: 'contactInfo', max: 20 },
  ],
  response_team: [
    { name: 'teamName', max: 100 },
    { name: 'assignedArea', max: 255 },
    { name: 'contactInfo', max: 20 },
  ],
  lgu: [
    { name: 'departmentName', max: 100 },
    { name: 'officerInCharge', max: 100 },
    { name: 'contactInfo', max: 20 },
  ],
};

export function validateProfile(role, form) {
  const errors = {};
  for (const { name, max } of PROFILE_FIELDS[role]) {
    if (name === 'contactInfo') {
      const contact = form.contactInfo.trim();
      if (!contact) errors.contactInfo = 'FIELD_REQUIRED';
      else if (!MOBILE_PATTERN.test(contact.replace(/[\s-]/g, ''))) errors.contactInfo = 'INVALID_CONTACT';
    } else {
      const code = requiredText(form[name], max);
      if (code) errors[name] = code;
    }
  }
  return errors;
}

/** New response team account: team details + username + password (same rules as the server). */
export function validateNewTeam(form) {
  const errors = validateProfile('response_team', form);

  const username = form.username.trim();
  if (!username) errors.username = 'FIELD_REQUIRED';
  else if (!USERNAME_PATTERN.test(username)) errors.username = 'INVALID_USERNAME';

  if (!form.password) errors.password = 'FIELD_REQUIRED';
  else if (form.password.length < 8) errors.password = 'PASSWORD_TOO_SHORT';
  else if (form.password.length > 72) errors.password = 'PASSWORD_TOO_LONG';

  if (!form.confirmPassword) errors.confirmPassword = 'FIELD_REQUIRED';
  else if (form.password !== form.confirmPassword) errors.confirmPassword = 'PASSWORDS_DONT_MATCH';

  return errors;
}

export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  const errors = {};
  if (!currentPassword) errors.currentPassword = 'FIELD_REQUIRED';
  if (!newPassword) errors.newPassword = 'FIELD_REQUIRED';
  else if (newPassword.length < 8) errors.newPassword = 'PASSWORD_TOO_SHORT';
  else if (newPassword.length > 72) errors.newPassword = 'PASSWORD_TOO_LONG';
  else if (newPassword === currentPassword) errors.newPassword = 'SAME_PASSWORD';
  if (!confirmPassword) errors.confirmPassword = 'FIELD_REQUIRED';
  else if (newPassword !== confirmPassword) errors.confirmPassword = 'PASSWORDS_DONT_MATCH';
  return errors;
}

export function validateLogin({ username, password }) {
  const errors = {};
  if (!username.trim()) errors.username = 'FIELD_REQUIRED';
  if (!password) errors.password = 'FIELD_REQUIRED';
  return errors;
}

export function validateRegistration(form) {
  const errors = {};
  const add = (field, code) => {
    if (code) errors[field] = code;
  };

  add('name', requiredText(form.name, 100));
  add('address', requiredText(form.address, 255));

  const contact = form.contactInfo.trim();
  if (!contact) add('contactInfo', 'FIELD_REQUIRED');
  else if (!MOBILE_PATTERN.test(contact.replace(/[\s-]/g, ''))) add('contactInfo', 'INVALID_CONTACT');

  const username = form.username.trim();
  if (!username) add('username', 'FIELD_REQUIRED');
  else if (!USERNAME_PATTERN.test(username)) add('username', 'INVALID_USERNAME');

  if (!form.password) add('password', 'FIELD_REQUIRED');
  else if (form.password.length < 8) add('password', 'PASSWORD_TOO_SHORT');
  else if (form.password.length > 72) add('password', 'PASSWORD_TOO_LONG');

  if (!form.confirmPassword) add('confirmPassword', 'FIELD_REQUIRED');
  else if (form.password !== form.confirmPassword) add('confirmPassword', 'PASSWORDS_DONT_MATCH');

  // Agreement to the Data Privacy Notice (the server checks this too).
  if (form.privacyConsent !== true) add('privacyConsent', 'CONSENT_REQUIRED');

  return errors;
}
