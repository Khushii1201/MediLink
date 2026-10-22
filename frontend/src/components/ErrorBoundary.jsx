import { Component } from 'react';
import { Button } from './Button';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-screen">
          <div className="card text-center" style={{ maxWidth: '500px', margin: '4rem auto' }}>
            <span style={{ fontSize: '3rem' }}>⚠️</span>
            <h2>Something went wrong</h2>
            <p className="muted">
              An unexpected error occurred while rendering this interface.
            </p>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
              <Button variant="secondary" onClick={() => (window.location.href = '/')}>
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
