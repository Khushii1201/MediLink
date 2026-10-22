import { useState } from 'react';
import { api } from '../../api';
import { useToast } from '../../hooks/useToast';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { StatusStepper } from '../../components/StatusStepper';
import { ConfirmDialog } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';

const ADMISSION_STEPS = [
  { label: 'Pending Review', description: 'Submitted to triage queue' },
  { label: 'Accepted', description: 'Bed reserved & prepared' },
  { label: 'Completed', description: 'Patient admitted & checked in' },
];

function getAdmissionStepIndex(status) {
  if (status === 'PENDING') return 0;
  if (status === 'ACCEPTED') return 1;
  if (status === 'COMPLETED') return 2;
  return 0;
}

export default function AdmissionsTab({ admissions = [], onRefresh, onOpenNewRequest }) {
  const { addToast } = useToast();
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.cancelAdmission(cancelTarget.admission_id);
      addToast('Admission request cancelled successfully', 'success');
      setCancelTarget(null);
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to cancel admission', 'error');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="tab-pane admissions-tab">
      <div className="tab-header-row">
        <div>
          <h3>My Emergency Admissions</h3>
          <p className="muted">Track submission statuses and admission approvals from hospital operations.</p>
        </div>
        <Button variant="primary" size="sm" onClick={onOpenNewRequest}>
          <span>+ New Admission Request</span>
        </Button>
      </div>

      {admissions.length === 0 ? (
        <EmptyState
          title="No active or past admission requests"
          message="You have not submitted any emergency admission requests yet."
          actionLabel="Submit Admission Request"
          onAction={onOpenNewRequest}
        />
      ) : (
        <div className="admissions-list-grid">
          {admissions.map((adm) => {
            const isCancelled = adm.status === 'CANCELLED' || adm.status === 'REJECTED';
            const stepIdx = getAdmissionStepIndex(adm.status);

            return (
              <div key={adm.admission_id} className="card admission-record-card">
                <div className="record-header">
                  <div>
                    <h4 className="record-hospital-name">{adm.hospital_name}</h4>
                    <span className="record-timestamp">
                      Requested on {new Date(adm.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="record-status-tags">
                    <Badge status={adm.severity} label={`${adm.severity} Priority`} size="sm" />
                    <Badge status={adm.status} size="sm" />
                  </div>
                </div>

                <div className="record-body">
                  <p className="record-reason">
                    <strong>Condition / Reason:</strong> {adm.reason || 'General emergency triage'}
                  </p>
                  {adm.preferred_department && (
                    <p className="record-dept">
                      <strong>Target Dept:</strong> {adm.preferred_department}
                    </p>
                  )}
                  {adm.hospital_phone && (
                    <p className="record-phone">
                      <strong>Hospital Desk:</strong> {adm.hospital_phone}
                    </p>
                  )}
                </div>

                {/* Status Stepper */}
                <div className="record-stepper-wrap">
                  <StatusStepper
                    steps={ADMISSION_STEPS}
                    currentStepIndex={stepIdx}
                    isCancelled={isCancelled}
                  />
                </div>

                {adm.status === 'PENDING' && (
                  <div className="record-footer">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCancelTarget(adm)}
                    >
                      Cancel Request
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title="Cancel Admission Request"
        message={`Are you sure you want to cancel your admission request for ${cancelTarget?.hospital_name}?`}
        confirmText="Yes, Cancel Request"
        loading={cancelling}
      />
    </div>
  );
}
