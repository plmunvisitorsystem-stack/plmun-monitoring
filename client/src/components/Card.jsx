/**
 * White card with border, rounded corners, and a light shadow.
 *   title: optional heading at the top of the card (already translated)
 */
import './Card.css';

export default function Card({ title, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </section>
  );
}
