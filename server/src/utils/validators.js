/**
 * Input validation helpers.
 * Each check returns an error CODE (e.g. 'FIELD_REQUIRED') or null if valid.
 * The client translates the code into English or Tagalog, so the server
 * never needs to know which language the user picked.
 * (client/src/utils/validation.js has the same rules for instant feedback.)
 */

const USERNAME_PATTERN = /^[A-Za-z0-9._]{4,30}$/;
// Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX (spaces and dashes allowed)
const MOBILE_PATTERN = /^(09\d{9}|\+639\d{9})$/;

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt only uses the first 72 bytes

// Returns the trimmed string, or '' if the value is not a string.
function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function checkRequiredText(value, maxLength) {
  if (!value) return 'FIELD_REQUIRED';
  if (value.length > maxLength) return 'TOO_LONG';
  return null;
}

function checkUsername(username) {
  if (!username) return 'FIELD_REQUIRED';
  if (!USERNAME_PATTERN.test(username)) return 'INVALID_USERNAME';
  return null;
}

function checkContact(contact) {
  if (!contact) return 'FIELD_REQUIRED';
  const digitsOnly = contact.replace(/[\s-]/g, '');
  if (!MOBILE_PATTERN.test(digitsOnly)) return 'INVALID_CONTACT';
  return null;
}

function checkPassword(password) {
  if (!password) return 'FIELD_REQUIRED';
  if (password.length < PASSWORD_MIN) return 'PASSWORD_TOO_SHORT';
  if (password.length > PASSWORD_MAX) return 'PASSWORD_TOO_LONG';
  return null;
}

/**
 * Validates the resident registration form.
 * Returns { values, errors } where errors is { fieldName: CODE }.
 */
function validateRegistration(body) {
  const values = {
    name: cleanText(body.name),
    address: cleanText(body.address),
    contactInfo: cleanText(body.contactInfo),
    username: cleanText(body.username),
    // Passwords are NOT trimmed: spaces can be part of a password.
    password: typeof body.password === 'string' ? body.password : '',
    confirmPassword: typeof body.confirmPassword === 'string' ? body.confirmPassword : '',
    // The resident must agree to the Data Privacy Notice (RA 10173) - exactly true.
    privacyConsent: body.privacyConsent === true,
  };

  const errors = {};
  const add = (field, code) => {
    if (code) errors[field] = code;
  };

  if (!values.privacyConsent) add('privacyConsent', 'CONSENT_REQUIRED');
  add('name', checkRequiredText(values.name, 100));
  add('address', checkRequiredText(values.address, 255));
  add('contactInfo', checkContact(values.contactInfo));
  add('username', checkUsername(values.username));
  add('password', checkPassword(values.password));
  if (!values.confirmPassword) add('confirmPassword', 'FIELD_REQUIRED');
  else if (values.password !== values.confirmPassword) add('confirmPassword', 'PASSWORDS_DONT_MATCH');

  return { values, errors };
}

// ----- Reports -----
const AREAS = require('../../config/areas');
const ISSUE_TYPES =['Waste Disposal', 'Pollution', 'Flooding', 'Other Hazard'];
const LOCATION_MIN = 3;
const LOCATION_MAX = 150;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 1000;

/**
 * Validates a new report.
 * Returns { values, errors } where errors is { fieldName: CODE }.
 */
function validateReport(body) {
  const values = {
    issueType: typeof body.issueType === 'string' ? body.issueType : '',
    area: typeof body.area === 'string' ? body.area : '',
    location: cleanText(body.location),
    description: cleanText(body.description),
  };

  const errors = {};

  if (!ISSUE_TYPES.includes(values.issueType)) errors.issueType = 'INVALID_ISSUE_TYPE';

  // The area must be one of the puroks in config/areas.js.
  if (!values.area) errors.area = 'AREA_REQUIRED';
  else if (!AREAS.includes(values.area)) errors.area = 'INVALID_AREA';

  if (!values.location) errors.location = 'FIELD_REQUIRED';
  else if (values.location.length < LOCATION_MIN) errors.location = 'LOCATION_TOO_SHORT';
  else if (values.location.length > LOCATION_MAX) errors.location = 'LOCATION_TOO_LONG';

  if (!values.description) errors.description = 'FIELD_REQUIRED';
  else if (values.description.length < DESCRIPTION_MIN) errors.description = 'DESCRIPTION_TOO_SHORT';
  else if (values.description.length > DESCRIPTION_MAX) errors.description = 'DESCRIPTION_TOO_LONG';

  return { values, errors };
}

/**
 * Reads ?issue_type=&area= for GET /api/reports/similar. Both are required.
 * Returns { values: { issueType, area }, errors }.
 */
function validateSimilarQuery(query) {
  const issueType = cleanText(query.issue_type);
  const area = cleanText(query.area);
  const errors = {};
  if (!ISSUE_TYPES.includes(issueType)) errors.issue_type = 'INVALID_ISSUE_TYPE';
  if (!AREAS.includes(area)) errors.area = 'INVALID_AREA';
  return { values: { issueType, area }, errors };
}

// ----- Feedback -----
const COMMENT_MAX = 500;

/**
 * Validates feedback: rating is a whole number 1-5 (required),
 * comments are optional text up to 500 characters (empty -> null).
 */
function validateFeedback(body) {
  // Accept 4 or "4"; reject true, 4.5, "abc", 0, 6, etc.
  const isNumberLike = typeof body.rating === 'number' || (typeof body.rating === 'string' && body.rating.trim() !== '');
  const rating = isNumberLike ? Number(body.rating) : NaN;
  const comments = cleanText(body.comments);
  const errors = {};

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'RATING_REQUIRED';

  if (body.comments !== undefined && body.comments !== null && typeof body.comments !== 'string') {
    errors.comments = 'INVALID_COMMENT';
  } else if (comments.length > COMMENT_MAX) {
    errors.comments = 'COMMENT_TOO_LONG';
  }

  return { values: { rating, comments: comments || null }, errors };
}

// ----- Profile -----
// Maximum length of each profile field (matches the database columns).
const PROFILE_LIMITS = {
  resident: { name: 100, address: 255 },
  response_team: { teamName: 100, assignedArea: 255 },
  lgu: { departmentName: 100, officerInCharge: 100 },
};

/**
 * Validates the profile fields for a role. contactInfo is checked as a
 * Philippine mobile number for every role (same rule as registration).
 * Fields that do not belong to the role (e.g. username) are ignored.
 */
function validateProfile(role, body) {
  const limits = PROFILE_LIMITS[role];
  const values = {};
  const errors = {};

  for (const [field, maxLength] of Object.entries(limits)) {
    values[field] = cleanText(body[field]);
    const code = checkRequiredText(values[field], maxLength);
    if (code) errors[field] = code;
  }

  values.contactInfo = cleanText(body.contactInfo);
  const contactCode = checkContact(values.contactInfo);
  if (contactCode) errors.contactInfo = contactCode;

  return { values, errors };
}

/** Validates the change-password form. */
function validatePasswordChange(body) {
  const values = {
    currentPassword: typeof body.currentPassword === 'string' ? body.currentPassword : '',
    newPassword: typeof body.newPassword === 'string' ? body.newPassword : '',
    confirmPassword: typeof body.confirmPassword === 'string' ? body.confirmPassword : '',
  };
  const errors = {};

  if (!values.currentPassword) errors.currentPassword = 'FIELD_REQUIRED';
  const newCode = checkPassword(values.newPassword);
  if (newCode) errors.newPassword = newCode;
  else if (values.newPassword === values.currentPassword) errors.newPassword = 'SAME_PASSWORD';
  if (!values.confirmPassword) errors.confirmPassword = 'FIELD_REQUIRED';
  else if (values.newPassword !== values.confirmPassword) errors.confirmPassword = 'PASSWORDS_DONT_MATCH';

  return { values, errors };
}

// ----- Report list filters (query string) -----
const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// True for a real calendar date like 2026-02-28 (not 2026-02-30).
function isValidDate(text) {
  if (!DATE_PATTERN.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

/**
 * Reads a yes/no filter such as ?overdue=1 ("1"/"true" = yes; empty, "0", "false" = no).
 * Any other value adds an INVALID_FILTER error. Returns true or false.
 */
function readYesNo(query, name, errors) {
  const text = typeof query[name] === 'string' ? query[name].trim() : '';
  const allowed = ['', '1', '0', 'true', 'false'];
  // A list (?overdue[]=1) or any other text is an error.
  if (query[name] !== undefined && (typeof query[name] !== 'string' || !allowed.includes(text))) errors[name] = 'INVALID_FILTER';
  return text === '1' || text === 'true';
}

/**
 * Reads ?issueType=&status=&overdue=&dateFrom=&dateTo=&search=&page= from the URL.
 * Empty values mean "no filter"; overdue=1 shows only overdue reports.
 * Returns { filters, errors }.
 * search becomes { text, id, year }: "#2026-0013" -> id 13, year 2026; "13" -> id 13.
 */
function validateReportFilters(query) {
  const read = (name) => (typeof query[name] === 'string' ? query[name].trim() : '');
  const errors = {};

  const issueType = read('issueType');
  if (issueType && !ISSUE_TYPES.includes(issueType)) errors.issueType = 'INVALID_FILTER';

  const status = read('status');
  if (status && !STATUSES.includes(status)) errors.status = 'INVALID_FILTER';

  const dateFrom = read('dateFrom');
  const dateTo = read('dateTo');
  if (dateFrom && !isValidDate(dateFrom)) errors.dateFrom = 'INVALID_FILTER';
  if (dateTo && !isValidDate(dateTo)) errors.dateTo = 'INVALID_FILTER';
  if (!errors.dateFrom && !errors.dateTo && dateFrom && dateTo && dateFrom > dateTo) errors.dateTo = 'INVALID_DATE_RANGE';

  const searchText = read('search').slice(0, 150);
  let search = null;
  if (searchText) {
    search = { text: searchText, id: null, year: null };
    const withYear = searchText.match(/^#?(\d{4})-(\d{1,9})$/);
    const idOnly = searchText.match(/^#?(\d{1,9})$/);
    if (withYear) {
      search.year = Number(withYear[1]);
      search.id = Number(withYear[2]);
    } else if (idOnly) {
      search.id = Number(idOnly[1]);
    }
  }

  const overdue = readYesNo(query, 'overdue', errors);

  // Page: a whole number from 1 up; anything else becomes page 1.
  const pageNumber = Number(read('page'));
  const page = Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 100000 ? pageNumber : 1;

  return {
    filters: { issueType: issueType || null, status: status || null, overdue, dateFrom: dateFrom || null, dateTo: dateTo || null, search, page },
    errors,
  };
}

// ----- LGU Reports list (assign to team) -----
const PRIORITIES = ['High', 'Medium', 'Low'];

/**
 * Reads ?status=&priority=&area=&issueType=&unassigned=&overdue=&page= from the URL.
 * Empty values mean "no filter"; unassigned=1 shows only reports with no team;
 * overdue=1 shows only overdue reports.
 * Returns { filters, errors }.
 */
function validateAssignFilters(query) {
  const read = (name) => (typeof query[name] === 'string' ? query[name].trim() : '');
  const errors = {};

  const status = read('status');
  if (status && !STATUSES.includes(status)) errors.status = 'INVALID_FILTER';
  const priority = read('priority');
  if (priority && !PRIORITIES.includes(priority)) errors.priority = 'INVALID_FILTER';
  const area = read('area');
  if (area && !AREAS.includes(area)) errors.area = 'INVALID_FILTER';
  const issueType = read('issueType');
  if (issueType && !ISSUE_TYPES.includes(issueType)) errors.issueType = 'INVALID_FILTER';

  const unassigned = readYesNo(query, 'unassigned', errors);
  const overdue = readYesNo(query, 'overdue', errors);

  const pageNumber = Number(read('page'));
  const page = Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 100000 ? pageNumber : 1;

  return {
    filters: { status: status || null, priority: priority || null, area: area || null, issueType: issueType || null, unassigned, overdue, page },
    errors,
  };
}

// ----- Status update by a response team -----
const NOTES_MAX = 2000;

/**
 * Validates { status, resolutionNotes }. Whether the status is the correct
 * NEXT status is checked later against the database (it depends on the report).
 */
function validateStatusUpdate(body) {
  const status = typeof body.status === 'string' ? body.status : '';
  const errors = {};

  if (!status) errors.status = 'STATUS_REQUIRED';
  else if (!STATUSES.includes(status)) errors.status = 'INVALID_STATUS_CHANGE';

  let resolutionNotes = '';
  if (body.resolutionNotes !== undefined && body.resolutionNotes !== null && typeof body.resolutionNotes !== 'string') {
    errors.resolutionNotes = 'INVALID_COMMENT';
  } else {
    resolutionNotes = cleanText(body.resolutionNotes);
    if (resolutionNotes.length > NOTES_MAX) errors.resolutionNotes = 'NOTES_TOO_LONG';
  }

  return { values: { status, resolutionNotes: resolutionNotes || null }, errors };
}

// ----- Administration (LGU) -----
const ROLES_IN_USER_LIST = ['resident', 'response_team'];
const ACCOUNT_STATUSES = ['Active', 'Inactive'];

/** Reads ?role=&status=&search= for the Manage Users list. */
function validateUserFilters(query) {
  const read = (name) => (typeof query[name] === 'string' ? query[name].trim() : '');
  const errors = {};

  const role = read('role');
  if (role && !ROLES_IN_USER_LIST.includes(role)) errors.role = 'INVALID_FILTER';
  const status = read('status');
  if (status && !ACCOUNT_STATUSES.includes(status)) errors.status = 'INVALID_FILTER';

  return { filters: { role: role || null, status: status || null, search: read('search').slice(0, 100) }, errors };
}

/** Validates a new response team account (details + username + password). */
function validateNewTeam(body) {
  const { values, errors } = validateProfile('response_team', body);

  values.username = cleanText(body.username);
  const usernameCode = checkUsername(values.username);
  if (usernameCode) errors.username = usernameCode;

  values.password = typeof body.password === 'string' ? body.password : '';
  const passwordCode = checkPassword(values.password);
  if (passwordCode) errors.password = passwordCode;

  const confirm = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
  if (!confirm) errors.confirmPassword = 'FIELD_REQUIRED';
  else if (confirm !== values.password) errors.confirmPassword = 'PASSWORDS_DONT_MATCH';

  return { values, errors };
}

/** Validates { status } for activating/deactivating a resident. */
function validateAccountStatus(body) {
  const status = typeof body.status === 'string' ? body.status : '';
  return ACCOUNT_STATUSES.includes(status) ? { status, errors: {} } : { status, errors: { status: 'INVALID_ACCOUNT_STATUS' } };
}

// ----- Chat Schedule (LGU) -----
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/; // 24-hour "HH:MM"

// Reads { isOpen, start, end } for one day. When open, start and end must be
// valid times with start before end. Closed days keep their times if valid.
function readHours(item, errors, key) {
  const isOpen = item.isOpen === true;
  const start = typeof item.start === 'string' ? item.start.trim() : '';
  const end = typeof item.end === 'string' ? item.end.trim() : '';
  if (isOpen) {
    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) errors[key] = 'INVALID_TIME';
    else if (start >= end) errors[key] = 'INVALID_TIME_RANGE';
  }
  const valid = TIME_PATTERN.test(start) && TIME_PATTERN.test(end);
  return { isOpen, start: valid ? start : '08:00', end: valid ? end : '17:00' };
}

/**
 * Validates { days: [{ dayOfWeek: 1-7, isOpen, start: 'HH:MM', end: 'HH:MM' }] }:
 * exactly the 7 days of the week, once each (1 = Monday ... 7 = Sunday).
 * Errors use the key "day<N>", e.g. { day3: 'INVALID_TIME_RANGE' }.
 * Returns { days, errors } with days sorted Monday first.
 */
function validateWeeklySchedule(body) {
  const errors = {};
  const list = Array.isArray(body.days) ? body.days : [];
  const seen = new Set(list.map((item) => Number(item?.dayOfWeek)));
  if (list.length !== 7 || seen.size !== 7 || [...seen].some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    return { days: [], errors: { days: 'INVALID_SCHEDULE' } };
  }
  const days = list
    .map((item) => ({ dayOfWeek: Number(item.dayOfWeek), ...readHours(item, errors, `day${Number(item.dayOfWeek)}`) }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return { days, errors };
}

/**
 * Validates a special date (holiday or different hours):
 *   { date: 'YYYY-MM-DD', isOpen, start, end }; the date may not be before today (Manila).
 *   today: 'YYYY-MM-DD' in Manila time.
 * Returns { values, errors }.
 */
function validateSpecialDate(body, today) {
  const errors = {};
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  if (!date) errors.date = 'FIELD_REQUIRED';
  else if (!isValidDate(date)) errors.date = 'INVALID_DATE';
  else if (date < today) errors.date = 'DATE_IN_PAST';
  const hours = readHours(body, errors, 'end');
  return { values: { date, ...hours }, errors };
}

module.exports = {
  validateWeeklySchedule,
  validateSpecialDate,
  validateUserFilters,
  validateNewTeam,
  validateAccountStatus,
  validateStatusUpdate,
  validateReportFilters,
  validateAssignFilters,
  validateSimilarQuery,
  cleanText,
  validateRegistration,
  validateReport,
  validateFeedback,
  validateProfile,
  validatePasswordChange,
};
