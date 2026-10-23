import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

export default function About() {
  return (
    <div className="page about-page">
      <div className="page-header text-center" style={{ maxWidth: '780px', margin: '0 auto 2.5rem auto' }}>
        <span className="section-tag">How MediLink Works</span>
        <h2>Connecting Patients with Timely Emergency Care</h2>
        <p className="muted">
          MediLink coordinates critical healthcare resources across hospitals, ambulance operators,
          and blood banks to help patients and families navigate medical emergencies with clarity and confidence.
        </p>
      </div>

      <div className="about-sections-wrap" style={{ maxWidth: '850px', margin: '0 auto' }}>
        {/* Step 1: Hospital Discovery */}
        <div className="card about-card">
          <div className="about-step-header">
            <span className="about-step-number">1</span>
            <div>
              <h3>Find and Compare Nearby Hospitals</h3>
              <p className="muted">Real-time resource visibility before you travel</p>
            </div>
          </div>
          <p>
            During an emergency, visiting a hospital only to discover that beds or specialized care are unavailable
            causes dangerous delays. MediLink allows patients and families to:
          </p>
          <ul className="about-feature-list">
            <li>
              <strong>Check Current Bed Capacity:</strong> View available General Ward, ICU, and Ventilator beds at verified regional hospitals.
            </li>
            <li>
              <strong>Compare Distances:</strong> See straight-line travel distances from your location to each medical center.
            </li>
            <li>
              <strong>Filter by Medical Specialty:</strong> Locate specialized facilities equipped for Cardiology, Trauma Surgery, Neurology, Pediatrics, and more.
            </li>
            <li>
              <strong>Estimate Waiting Times:</strong> Review estimated emergency turnaround times based on reported ward activity and current occupancy.
            </li>
          </ul>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/hospitals">
              <Button variant="outline" size="sm">Explore Hospital Directory</Button>
            </Link>
          </div>
        </div>

        {/* Step 2: Recommendations */}
        <div className="card about-card">
          <div className="about-step-header">
            <span className="about-step-number">2</span>
            <div>
              <h3>Clear, Transparent Recommendations</h3>
              <p className="muted">Intelligent guidance based on what matters most in an emergency</p>
            </div>
          </div>
          <p>
            MediLink evaluates multiple practical factors to suggest suitable hospitals for your situation:
          </p>
          <div className="about-grid-two">
            <div className="about-subcard">
              <h4>Proximity</h4>
              <p className="muted">Closer facilities are prioritized so transit time is minimized during critical windows.</p>
            </div>
            <div className="about-subcard">
              <h4>Available Capacity</h4>
              <p className="muted">Hospitals with confirmed open beds rank higher than facilities operating near full capacity.</p>
            </div>
            <div className="about-subcard">
              <h4>Expected Turnaround</h4>
              <p className="muted">Estimated wait times help avoid routing emergencies to heavily congested emergency rooms.</p>
            </div>
            <div className="about-subcard">
              <h4>Clinical Specialty</h4>
              <p className="muted">When you search for specific medical care, hospitals with that department are highlighted.</p>
            </div>
          </div>
          <p className="muted" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
            Every recommendation includes a plain-language summary explaining why a facility was suggested, empowering you to make informed decisions.
          </p>
        </div>

        {/* Step 3: Emergency Admission & Ambulances */}
        <div className="card about-card">
          <div className="about-step-header">
            <span className="about-step-number">3</span>
            <div>
              <h3>Emergency Requests & Ambulance Coordination</h3>
              <p className="muted">Fast-track admission notices and nearest-vehicle dispatch</p>
            </div>
          </div>
          <p>
            When every minute counts, MediLink coordinates critical touchpoints simultaneously:
          </p>
          <ul className="about-feature-list">
            <li>
              <strong>Advance Admission Requests:</strong> Send an emergency triage notice to your chosen hospital so clinical teams can prepare before your arrival.
            </li>
            <li>
              <strong>Nearest Ambulance Dispatch:</strong> The system automatically searches for the closest available ambulance within operational range and alerts the operator.
            </li>
            <li>
              <strong>Live Trip Tracking:</strong> Once dispatched, track the vehicle's progress on an interactive map with updated status milestones from dispatch to destination.
            </li>
          </ul>
        </div>

        {/* Step 4: Blood Inventory */}
        <div className="card about-card">
          <div className="about-step-header">
            <span className="about-step-number">4</span>
            <div>
              <h3>Blood Inventory & Hold Reservations</h3>
              <p className="muted">Locate matching units and secure blood products quickly</p>
            </div>
          </div>
          <p>
            Finding compatible blood units during surgery or acute trauma can be stressful. MediLink simplifies this process:
          </p>
          <ul className="about-feature-list">
            <li>
              <strong>Multi-Bank Search:</strong> Browse live stock listings across all 8 standard blood groups (A+, A-, B+, B-, AB+, AB-, O+, O-).
            </li>
            <li>
              <strong>Transfusion Compatibility Guidance:</strong> Filter donor units compatible with the patient's blood type (e.g., universal donor O- or recipient AB+).
            </li>
            <li>
              <strong>Urgent Hold Reservations:</strong> Place a reservation request directly through the platform. Blood bank personnel review and hold the units for patient collection.
            </li>
          </ul>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/blood">
              <Button variant="outline" size="sm">Check Blood Inventory</Button>
            </Link>
          </div>
        </div>

        {/* Step 5: How Stakeholders Participate */}
        <div className="card about-card">
          <div className="about-step-header">
            <span className="about-step-number">5</span>
            <div>
              <h3>How Healthcare Providers Participate</h3>
              <p className="muted">A collaborative coordination network</p>
            </div>
          </div>
          <p>MediLink is designed as a shared operational environment where each participant has dedicated responsibilities:</p>
          <div className="about-grid-two">
            <div className="about-subcard">
              <h4>Hospital Resource Managers</h4>
              <p className="muted">Maintain facility-wide bed, ICU, and ventilator capacity so availability numbers stay accurate.</p>
            </div>
            <div className="about-subcard">
              <h4>Clinical Staff & Doctors</h4>
              <p className="muted">Review incoming emergency admissions, triage urgency levels, and prepare clinical reception.</p>
            </div>
            <div className="about-subcard">
              <h4>Ambulance Operators</h4>
              <p className="muted">Receive nearest dispatch calls, broadcast GPS coordinates during transit, and confirm patient handoff.</p>
            </div>
            <div className="about-subcard">
              <h4>Blood Bank Technicians</h4>
              <p className="muted">Log available donor units, review reservation requests, and manage unit dispensation.</p>
            </div>
          </div>
        </div>

        {/* Step 6: When Resources Are Limited */}
        <div className="card about-card">
          <div className="about-step-header">
            <span className="about-step-number">6</span>
            <div>
              <h3>What to Expect When Resources Are Limited</h3>
              <p className="muted">Transparency during capacity constraints</p>
            </div>
          </div>
          <p>
            Healthcare demand can surge unexpectedly during mass emergencies or seasonal peaks. Here is how MediLink handles limited availability:
          </p>
          <ul className="about-feature-list">
            <li>
              <strong>Full Bed Queues:</strong> If a hospital has 0 available beds, the platform marks it as depleted and directs you toward alternate nearby facilities with open capacity.
            </li>
            <li>
              <strong>Ambulance Fleet Busy:</strong> If all ambulances within range are currently on trip, your request is safely queued and flagged so operators can accept it as soon as a vehicle becomes free.
            </li>
            <li>
              <strong>Depleted Blood Stock:</strong> If a specific blood bank has zero units for a blood group, MediLink displays compatible alternatives or nearby blood banks that still have stock.
            </li>
          </ul>
        </div>

        {/* Important Healthcare Boundaries */}
        <div className="card about-card boundary-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <h3>Important Medical & Safety Information</h3>
          <ul className="boundary-list">
            <li>
              <strong>Informational Coordination:</strong> MediLink provides resource discovery and operational routing. It is not an automated medical diagnostic tool or a clinical triage authority.
            </li>
            <li>
              <strong>Facility-Reported Data:</strong> Bed availability and waiting times reflect provider-reported numbers and demonstration data; always confirm critical requirements directly with the facility.
            </li>
            <li>
              <strong>Life-Threatening Emergencies:</strong> If you or someone with you is experiencing a severe, life-threatening medical emergency, call your national emergency hotline (<strong>112 in India</strong>) or proceed immediately to the nearest emergency room.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
