export function FormField({
  label,
  id,
  error,
  hint,
  required = false,
  children,
  className = '',
}) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={`form-field ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label} {required && <span className="req-star" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p id={hintId} className="form-hint">{hint}</p>}
      {error && <p id={errorId} className="form-error" role="alert">{error}</p>}
    </div>
  );
}

export default FormField;
