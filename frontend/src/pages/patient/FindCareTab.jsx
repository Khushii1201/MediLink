import { useState } from 'react';
import { api } from '../../api';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import { Spinner } from '../../components/Spinner';

export default function FindCareTab({ coords, onRequestAdmission }) {
  const [need, setNeed] = useState('GENERAL');
  const [specialty, setSpecialty] = useState('');
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGetRecommendations = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        lat: coords.lat,
        lng: coords.lng,
        need,
      };
      if (specialty.trim()) params.specialty = specialty.trim();

      const data = await api.getRecommendations(params);
      setRecommendations(data);
    } catch (err) {
      setError(err.message || 'Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-pane find-care-tab">
      <div className="card recommendation-query-card">
        <h3>Smart Hospital Recommendation Engine</h3>
        <p className="muted">
          Ranks facilities based on transparent multi-factor scoring: Geographical Distance (35%), Target Resource Availability (30%), Estimated Waiting Time (20%), and Medical Specialty (15%).
        </p>

        <div className="rec-form-grid">
          <FormField label="Required Care Level / Target Resource" id="rec-need">
            <select
              id="rec-need"
              className="form-input"
              value={need}
              onChange={(e) => setNeed(e.target.value)}
            >
              <option value="GENERAL">General Care (Hospital Beds)</option>
              <option value="ICU">Intensive Care Unit (ICU Beds)</option>
              <option value="VENTILATOR">Critical Respiratory (Ventilators)</option>
            </select>
          </FormField>

          <FormField label="Required Specialty (Optional)" id="rec-specialty" hint="e.g. Cardiology, Neurology, Trauma, Orthopedics">
            <input
              type="text"
              id="rec-specialty"
              className="form-input"
              placeholder="Leave blank for all departments"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </FormField>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Button variant="primary" onClick={handleGetRecommendations} loading={loading}>
            <span>🧠 Generate Ranked Recommendations</span>
          </Button>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Location: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </span>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
            <span>{error}</span>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ padding: '3rem 0', textAlign: 'center' }}>
          <Spinner size="lg" />
          <p className="muted" style={{ marginTop: '0.75rem' }}>Computing multi-factor score and travel distances...</p>
        </div>
      )}

      {recommendations && (
        <div className="recommendations-results-wrap" style={{ marginTop: '2rem' }}>
          <div className="rec-header-notice">
            <div>
              <h4>Ranked Facility Results ({recommendations.recommendations.length} matched)</h4>
              <p className="disclaimer-note">
                ℹ️ <em>{recommendations.note}</em>
              </p>
            </div>
          </div>

          <div className="rec-cards-list">
            {recommendations.recommendations.map((rec, index) => {
              const bd = rec.breakdown;
              const scorePct = Math.round(rec.score * 100);

              return (
                <div key={rec.hospital_id} className="card rec-item-card">
                  <div className="rec-card-header">
                    <div className="rec-rank-badge">
                      #{index + 1}
                    </div>
                    <div className="rec-hospital-main">
                      <h4 className="rec-hospital-name">{rec.name}</h4>
                      <p className="rec-hospital-addr">{rec.address}</p>
                    </div>
                    <div className="rec-score-box">
                      <span className="rec-score-label">Match Score</span>
                      <strong className="rec-score-value">{scorePct}%</strong>
                    </div>
                  </div>

                  {/* Factor Breakdown Bars */}
                  <div className="factor-breakdown-grid">
                    <div className="factor-bar-item">
                      <div className="factor-meta">
                        <span>Distance: <strong>{rec.distance_km ?? 'N/A'} km</strong></span>
                        <span className="factor-score-tag">{Math.round((bd?.distance?.score || 0) * 100)}%</span>
                      </div>
                      <div className="progress-bar-track small-track">
                        <div
                          className="progress-bar-fill fill-info"
                          style={{ width: `${Math.round((bd?.distance?.score || 0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="factor-bar-item">
                      <div className="factor-meta">
                        <span>{rec.target_resource?.type}: <strong>{rec.target_resource?.available}/{rec.target_resource?.total}</strong></span>
                        <span className="factor-score-tag">{Math.round((bd?.availability?.score || 0) * 100)}%</span>
                      </div>
                      <div className="progress-bar-track small-track">
                        <div
                          className="progress-bar-fill fill-success"
                          style={{ width: `${Math.round((bd?.availability?.score || 0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="factor-bar-item">
                      <div className="factor-meta">
                        <span>Est. Wait: <strong>{rec.avg_waiting_minutes}m</strong></span>
                        <span className="factor-score-tag">{Math.round((bd?.wait?.score || 0) * 100)}%</span>
                      </div>
                      <div className="progress-bar-track small-track">
                        <div
                          className="progress-bar-fill fill-warning"
                          style={{ width: `${Math.round((bd?.wait?.score || 0) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="factor-bar-item">
                      <div className="factor-meta">
                        <span>Specialty: <strong>{bd?.specialty?.matched ? 'Direct Match' : 'General'}</strong></span>
                        <span className="factor-score-tag">{bd?.specialty?.matched ? '100%' : '0%'}</span>
                      </div>
                      <div className="progress-bar-track small-track">
                        <div
                          className="progress-bar-fill fill-teal"
                          style={{ width: `${bd?.specialty?.matched ? 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rec-card-footer">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onRequestAdmission(rec)}
                    >
                      <span>🚨 Request Admission Here</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
