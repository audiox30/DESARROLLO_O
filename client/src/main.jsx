import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[FATAL REACT ERROR]', error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '40px auto', background: '#fff', border: '1px solid #fca5a5', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h2 style={{ color: '#dc2626', margin: '0 0 10px 0', fontSize: '20px', fontWeight: 'bold' }}>
            ⚠️ Ocurrió un error al cargar el módulo
          </h2>
          <p style={{ color: '#4b5563', fontSize: '14px', margin: '0 0 16px 0', lineHeight: '1.5' }}>
            {this.state.error && this.state.error.message}
          </p>
          <pre style={{ background: '#fef2f2', padding: '16px', borderRadius: '8px', color: '#991b1b', fontSize: '12px', overflowX: 'auto', border: '1px solid #fee2e2', whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.stack}
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button 
            onClick={() => { localStorage.clear(); window.location.href = '/'; }} 
            style={{ marginTop: '16px', padding: '10px 20px', background: '#0f172a', color: '#fff', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            Limpiar Sesión y Reiniciar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
