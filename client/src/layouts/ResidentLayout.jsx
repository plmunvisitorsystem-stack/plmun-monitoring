/**
 * Page frame for resident pages:
 *   phones:  header on top, content, navigation fixed at the bottom (easy to reach)
 *   desktop: header on top, navigation bar under it, wider content
 *   wide:    true for pages with two columns on desktop (Home, Report Details)
 */
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import SkipLink from '../components/SkipLink';
import './ResidentLayout.css';

export default function ResidentLayout({ children, activeKey, wide = false }) {
  return (
    <div className="resident-layout">
      <SkipLink />
      <Header />
      <BottomNav activeKey={activeKey} className="resident-layout__nav" />
      <main id="main-content" tabIndex={-1} className={`resident-layout__main ${wide ? 'resident-layout__main--wide' : ''}`}>
        {children}
      </main>
    </div>
  );
}
