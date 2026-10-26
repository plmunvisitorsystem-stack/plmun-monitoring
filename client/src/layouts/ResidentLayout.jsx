/**
 * Page frame for resident pages (mobile-first):
 * header on top, narrow content column, bottom navigation fixed at the bottom.
 */
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import './ResidentLayout.css';

export default function ResidentLayout({ children, activeKey }) {
  return (
    <div className="resident-layout">
      <Header />
      <main className="resident-layout__main">{children}</main>
      <BottomNav activeKey={activeKey} className="resident-layout__nav" />
    </div>
  );
}
