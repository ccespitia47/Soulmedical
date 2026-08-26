import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[GlobalErrorBoundary]', error, errorInfo.componentStack);
  }

  private handleRetry = (): void => {
    // Reload completo — descarta el estado corrupto de React/stores.
    window.location.reload();
  };

  private handleHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    // Fallback UI con inline styles + svg inline — no depende de Tailwind,
    // Icon component ni ningun otro modulo que pueda ser el que rompio.
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          Algo salio mal
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px', maxWidth: 480 }}>
          La aplicacion tuvo un error inesperado y no se pudo mostrar la pantalla.
        </p>
        {this.state.error && (
          <pre
            style={{
              fontSize: 12,
              color: '#991b1b',
              background: '#fef2f2',
              padding: 12,
              borderRadius: 8,
              maxWidth: 480,
              overflowX: 'auto',
              margin: '0 0 20px',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '10px 20px',
              background: '#00c2a8',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
          <button
            onClick={this.handleHome}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }
}
