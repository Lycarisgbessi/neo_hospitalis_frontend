import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="bg-red-50 text-red-700 border-b border-red-100">
              <CardTitle>Une erreur inattendue s'est produite</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-slate-600">
                L'application a rencontré un problème. Veuillez rafraîchir la page.
                Vos données sont sauvegardées en sécurité.
              </p>
              {this.state.error && (
                <div className="bg-slate-100 p-3 rounded-md overflow-auto text-xs text-slate-700 font-mono">
                  {this.state.error.toString()}
                </div>
              )}
              <Button onClick={() => window.location.reload()} className="w-full">
                Rafraîchir la page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children ?? null;
  }
}

export { ErrorBoundary };
