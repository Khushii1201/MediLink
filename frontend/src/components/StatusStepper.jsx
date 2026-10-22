export function StatusStepper({ steps = [], currentStepIndex = 0, isCancelled = false }) {
  return (
    <div className={`status-stepper ${isCancelled ? 'is-cancelled' : ''}`}>
      {steps.map((step, idx) => {
        let state = 'upcoming';
        if (isCancelled && idx === currentStepIndex) {
          state = 'cancelled';
        } else if (idx < currentStepIndex) {
          state = 'completed';
        } else if (idx === currentStepIndex) {
          state = 'active';
        }

        return (
          <div key={step.label} className={`stepper-item ${state}`}>
            <div className="stepper-circle">
              {state === 'completed' ? '✓' : idx + 1}
            </div>
            <div className="stepper-content">
              <span className="stepper-label">{step.label}</span>
              {step.description && <span className="stepper-desc">{step.description}</span>}
            </div>
            {idx < steps.length - 1 && <div className="stepper-line" />}
          </div>
        );
      })}
    </div>
  );
}

export default StatusStepper;
