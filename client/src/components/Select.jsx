/**
 * Labeled dropdown, styled like Input.
 *   label:   text above the dropdown (already translated)
 *   options: [{ value, label, disabled }]  (disabled is optional)
 * Other props (name, value, onChange...) go to the <select>.
 */
import { useId } from 'react';
import './Input.css';

export default function Select({ label, options, id, className = '', ...rest }) {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className={`field ${className}`}>
      <label htmlFor={selectId} className="field__label">
        {label}
      </label>
      <select id={selectId} className="field__control" {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
