/**
 * Hidden until focused with the keyboard: jumps past the navigation.
 * The page's <main> needs id="main-content" and tabIndex={-1}.
 */
import { useLanguage } from '../i18n/useLanguage';

export default function SkipLink() {
  const { t } = useLanguage();
  return (
    <a href="#main-content" className="skip-link">
      {t('common.skipToContent')}
    </a>
  );
}
