/**
 * LGU "Chat Schedule" (/admin/chat-schedule): when live chat is open,
 * always in Asia/Manila time.
 *   - status: open or closed right now, next opening, staff set to Available
 *   - weekly hours: open or closed for each day, opening and closing time
 *   - holidays and special dates: closed all day, or different hours;
 *     a special date replaces the weekly hours for that day
 * The server checks every value again (validators.js) and answers with the
 * whole schedule, which replaces what is on screen.
 */
import { useEffect, useState } from 'react';
import StaffLayout from '../../layouts/StaffLayout';
import Card from '../../components/Card';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Input from '../../components/Input';
import LoadError from '../../components/LoadError';
import { apiRequest } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useLanguage } from '../../i18n/useLanguage';
import { formatClock, formatWeekdayDate } from '../../utils/format';
import '../../components/ReportTable.css';
import './ChatSchedule.css';

const EMPTY_SPECIAL = { date: '', isOpen: false, start: '08:00', end: '12:00' };

export default function ChatSchedulePage() {
  const { t, language } = useLanguage();
  const { data, loading, errorCode, reload } = useApiData('/admin/chat-schedule');

  const [schedule, setSchedule] = useState(null); // latest answer from the server
  const [weekly, setWeekly] = useState([]); // the weekly form
  const [weeklyErrors, setWeeklyErrors] = useState({}); // { day3: CODE, days: CODE }
  const [weeklyNotice, setWeeklyNotice] = useState(null); // { type, code | key }
  const [savingWeekly, setSavingWeekly] = useState(false);

  const [special, setSpecial] = useState(EMPTY_SPECIAL);
  const [specialErrors, setSpecialErrors] = useState({});
  const [specialNotice, setSpecialNotice] = useState(null);
  const [savingSpecial, setSavingSpecial] = useState(false);

  function apply(result) {
    setSchedule(result);
    setWeekly(result.weekly);
  }

  useEffect(() => {
    if (data) apply(data);
  }, [data]);

  const dayName = (dayOfWeek) => t(`chatSchedule.days.${dayOfWeek}`);
  const noticeText = (notice) => (notice.code ? t(`errors.${notice.code}`) : t(notice.key));

  function changeDay(dayOfWeek, changes) {
    setWeekly((current) => current.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day)));
    setWeeklyErrors((current) => ({ ...current, [`day${dayOfWeek}`]: undefined }));
    setWeeklyNotice(null);
  }

  async function saveWeekly(event) {
    event.preventDefault();
    setSavingWeekly(true);
    setWeeklyNotice(null);
    try {
      apply(await apiRequest('/admin/chat-schedule/weekly', { method: 'PUT', body: { days: weekly } }));
      setWeeklyErrors({});
      setWeeklyNotice({ type: 'success', key: 'chatSchedule.weeklySaved' });
    } catch (error) {
      setWeeklyErrors(error.fields || {});
      setWeeklyNotice({ type: 'error', code: error.code });
    } finally {
      setSavingWeekly(false);
    }
  }

  function changeSpecial(changes) {
    setSpecial((current) => ({ ...current, ...changes }));
    setSpecialErrors({});
    setSpecialNotice(null);
  }

  async function addSpecial(event) {
    event.preventDefault();
    setSavingSpecial(true);
    setSpecialNotice(null);
    try {
      apply(await apiRequest('/admin/chat-schedule/special', { method: 'POST', body: special }));
      setSpecial(EMPTY_SPECIAL);
      setSpecialErrors({});
      setSpecialNotice({ type: 'success', key: 'chatSchedule.specialSaved' });
    } catch (error) {
      setSpecialErrors(error.fields || {});
      setSpecialNotice({ type: 'error', code: error.code });
    } finally {
      setSavingSpecial(false);
    }
  }

  async function removeSpecial(id) {
    setSpecialNotice(null);
    try {
      apply(await apiRequest(`/admin/chat-schedule/special/${id}`, { method: 'DELETE' }));
      setSpecialNotice({ type: 'success', key: 'chatSchedule.removed' });
    } catch (error) {
      setSpecialNotice({ type: 'error', code: error.code });
    }
  }

  const hoursText = (item) =>
    item.isOpen ? `${formatClock(item.start, language)} – ${formatClock(item.end, language)}` : t('chatSchedule.closedAllDay');

  const status = schedule?.status;

  return (
    <StaffLayout role="lgu">
      <div className="chat-schedule">
        <div>
          <h1 className="page-title">{t('chatSchedule.title')}</h1>
          <p className="text-muted">{t('chatSchedule.intro')}</p>
        </div>

        {loading && !schedule && <p className="text-muted" role="status">{t('common.loading')}</p>}
        {!loading && errorCode && !schedule && <LoadError code={errorCode} onRetry={reload} />}

        {schedule && (
          <>
            {/* Open or closed right now */}
            <Alert type={status.isOpenNow ? 'success' : 'info'} title={t(status.isOpenNow ? 'chatSchedule.openNow' : 'chatSchedule.closedNow')}>
              {!status.isOpenNow && status.nextOpening &&
                `${t('chatSchedule.nextOpening', {
                  day: formatWeekdayDate(status.nextOpening.date, language),
                  start: formatClock(status.nextOpening.start, language),
                })} · `}
              {t('chatSchedule.availableStaff', { count: status.availableStaff })}
            </Alert>

            <div className="chat-schedule__grid">
              {/* ----- Weekly hours ----- */}
              <Card title={t('chatSchedule.weeklyTitle')} className="chat-schedule__weekly">
                <form onSubmit={saveWeekly} noValidate>
                  {weeklyNotice && <Alert type={weeklyNotice.type}>{noticeText(weeklyNotice)}</Alert>}
                  <div className="team-table-wrap">
                    <table className="team-table schedule-table">
                      <thead>
                        <tr>
                          <th scope="col">{t('chatSchedule.day')}</th>
                          <th scope="col">{t('chatSchedule.open')}</th>
                          <th scope="col">{t('chatSchedule.opens')}</th>
                          <th scope="col">{t('chatSchedule.closes')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekly.map((day) => {
                          const error = weeklyErrors[`day${day.dayOfWeek}`];
                          const errorId = `day-error-${day.dayOfWeek}`;
                          return (
                            <tr key={day.dayOfWeek} className={day.isOpen ? '' : 'is-closed'}>
                              <th scope="row" className="schedule-table__day">
                                {dayName(day.dayOfWeek)}
                                {error && (
                                  <span id={errorId} className="schedule-table__error">
                                    {t(`errors.${error}`)}
                                  </span>
                                )}
                              </th>
                              <td data-label={t('chatSchedule.open')}>
                                <label className="check-field">
                                  <input
                                    type="checkbox"
                                    checked={day.isOpen}
                                    onChange={(event) => changeDay(day.dayOfWeek, { isOpen: event.target.checked })}
                                  />
                                  <span>{day.isOpen ? t('chatSchedule.open') : t('chatSchedule.closed')}</span>
                                  <span className="visually-hidden">{t('chatSchedule.openOnDay', { day: dayName(day.dayOfWeek) })}</span>
                                </label>
                              </td>
                              <td data-label={t('chatSchedule.opens')}>
                                <input
                                  type="time"
                                  className="field__control schedule-table__time"
                                  value={day.start}
                                  disabled={!day.isOpen}
                                  aria-label={t('chatSchedule.opensOnDay', { day: dayName(day.dayOfWeek) })}
                                  aria-invalid={error ? true : undefined}
                                  aria-describedby={error ? errorId : undefined}
                                  onChange={(event) => changeDay(day.dayOfWeek, { start: event.target.value })}
                                />
                              </td>
                              <td data-label={t('chatSchedule.closes')}>
                                <input
                                  type="time"
                                  className="field__control schedule-table__time"
                                  value={day.end}
                                  disabled={!day.isOpen}
                                  aria-label={t('chatSchedule.closesOnDay', { day: dayName(day.dayOfWeek) })}
                                  aria-invalid={error ? true : undefined}
                                  aria-describedby={error ? errorId : undefined}
                                  onChange={(event) => changeDay(day.dayOfWeek, { end: event.target.value })}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="chat-schedule__actions">
                    <Button type="submit" icon="check" disabled={savingWeekly}>
                      {savingWeekly ? t('chatSchedule.saving') : t('chatSchedule.saveWeekly')}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* ----- Holidays and special dates ----- */}
              <Card title={t('chatSchedule.specialTitle')} className="chat-schedule__special">
                <p className="text-muted">{t('chatSchedule.specialIntro')}</p>
                {specialNotice && <Alert type={specialNotice.type}>{noticeText(specialNotice)}</Alert>}

                {schedule.special.length === 0 ? (
                  <p className="chat-schedule__empty">{t('chatSchedule.noSpecial')}</p>
                ) : (
                  <ul className="special-list">
                    {schedule.special.map((item) => (
                      <li key={item.id} className="special-list__item">
                        <div>
                          <p className="special-list__date">{formatWeekdayDate(item.date, language)}</p>
                          <p className="special-list__hours">{hoursText(item)}</p>
                        </div>
                        <Button
                          variant="danger"
                          onClick={() => removeSpecial(item.id)}
                          aria-label={t('chatSchedule.removeLabel', { date: formatWeekdayDate(item.date, language) })}
                        >
                          {t('chatSchedule.remove')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <form className="special-form" onSubmit={addSpecial} noValidate>
                  <Input
                    label={t('chatSchedule.date')}
                    type="date"
                    min={status.now.date}
                    value={special.date}
                    onChange={(event) => changeSpecial({ date: event.target.value })}
                    error={specialErrors.date ? t(`errors.${specialErrors.date}`) : undefined}
                  />
                  <fieldset className="special-form__choice">
                    <legend className="field__label">{t('chatSchedule.hours')}</legend>
                    <label className="check-field">
                      <input type="radio" name="special-open" checked={!special.isOpen} onChange={() => changeSpecial({ isOpen: false })} />
                      <span>{t('chatSchedule.closedAllDay')}</span>
                    </label>
                    <label className="check-field">
                      <input type="radio" name="special-open" checked={special.isOpen} onChange={() => changeSpecial({ isOpen: true })} />
                      <span>{t('chatSchedule.openDifferentHours')}</span>
                    </label>
                  </fieldset>
                  {special.isOpen && (
                    <div className="special-form__times">
                      <Input label={t('chatSchedule.opens')} type="time" value={special.start} onChange={(event) => changeSpecial({ start: event.target.value })} />
                      <Input
                        label={t('chatSchedule.closes')}
                        type="time"
                        value={special.end}
                        onChange={(event) => changeSpecial({ end: event.target.value })}
                        error={specialErrors.end ? t(`errors.${specialErrors.end}`) : undefined}
                      />
                    </div>
                  )}
                  <div className="chat-schedule__actions">
                    <Button type="submit" icon="calendar" disabled={savingSpecial}>
                      {savingSpecial ? t('chatSchedule.adding') : t('chatSchedule.addSpecial')}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </>
        )}
      </div>
    </StaffLayout>
  );
}
