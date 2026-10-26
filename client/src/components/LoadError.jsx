/**
 * Error message with a "Try Again" button, shown when data fails to load.
 *   code:    error code from the API (e.g. 'NETWORK_ERROR')
 *   onRetry: function that loads the data again
 */
import Alert from './Alert';
import Button from './Button';
import { useLanguage } from '../i18n/useLanguage';

export default function LoadError({ code, onRetry }) {
  const { t } = useLanguage();

  return (
    <div className="load-error">
      <Alert type="error">{t(`errors.${code}`)}</Alert>
      {onRetry && (
        <Button variant="outline" fullWidth onClick={onRetry}>
          {t('common.tryAgain')}
        </Button>
      )}
    </div>
  );
}
