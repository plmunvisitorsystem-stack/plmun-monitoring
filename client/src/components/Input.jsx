/**
 * Labeled text input (or textarea when multiline is true).
 *   label: text shown above the field (required, already translated)
 *   hint:  optional helper text under the label
 *   error: optional error message; turns the field red
 *   trailing: optional element shown right after the field (e.g. show/hide button)
 * Any other props (value, onChange, type, required...) go to the <input>.
 */
import { useId } from 'react';
import Icon from './Icon';
import './Input.css';

export default function Input({
  label,
  hint,
  error,
  multiline = false,
  trailing,
  id,
  className = '',
  ...rest
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const Field = multiline ? 'textarea' : 'input';
  const control = (
    <Field
      id={inputId}
      className="field__control"
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  );

  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      <label htmlFor={inputId} className="field__label">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {trailing ? (
        <div className="field__group">
          {control}
          {trailing}
        </div>
      ) : (
        control
      )}
      {error && (
        <p id={errorId} className="field__error">
          <Icon name="alertCircle" size={18} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
