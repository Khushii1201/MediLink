import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

export default function NotFound() {
  return (
    <div className="page not-found-page">
      <div className="card text-center" style={{ maxWidth: '520px', margin: '5rem auto' }}>
        <h1 className="not-found-code">404</h1>
        <h2>Page Not Found</h2>
        <p className="muted">
          The requested page could not be located. It might have been moved or does not exist.
        </p>
        <div style={{ marginTop: '2rem' }}>
          <Link to="/">
            <Button variant="primary">Return to Homepage</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
