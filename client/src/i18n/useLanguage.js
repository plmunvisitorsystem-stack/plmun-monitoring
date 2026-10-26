/**
 * Hook for components to read and change the language.
 *
 *   const { t, language, setLanguage } = useLanguage();
 *   <h1>{t('nav.home')}</h1>
 */
import { useContext } from 'react';
import { LanguageContext } from './LanguageContext';

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside <LanguageProvider>.');
  }
  return context;
}
