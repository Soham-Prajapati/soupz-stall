import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/cn';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`Error in ${this.props.name}:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-4 bg-bg-surface">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={20} />
            <p className="text-sm font-ui font-medium">Something went wrong in {this.props.name}</p>
          </div>
          <p className="text-xs text-text-faint font-ui text-center max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-ui transition-all',
              'bg-accent text-white hover:opacity-90',
            )}
          >
            <RotateCcw size={12} />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
