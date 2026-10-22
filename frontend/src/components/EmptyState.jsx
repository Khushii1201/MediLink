import { Button } from './Button';

export function EmptyState({
  title = 'No items found',
  message = 'There is currently no data to display.',
  icon = null,
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon" aria-hidden="true">{icon}</div>}
      <h4 className="empty-title">{title}</h4>
      <p className="empty-message">{message}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
