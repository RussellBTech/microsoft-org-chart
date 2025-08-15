/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary, useErrorHandler } from '../ErrorBoundary';

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Component for testing the hook
const TestHookComponent = () => {
  const handleError = useErrorHandler();
  
  const triggerError = () => {
    try {
      throw new Error('Hook test error');
    } catch (error) {
      handleError(error as Error, 'test-component');
    }
  };
  
  return <button onClick={triggerError}>Trigger Error</button>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const CustomFallback = <div>Custom Error UI</div>;
    
    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onErrorMock = jest.fn();
    
    render(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('logs error to console', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('shows retry button when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Check that retry button is present and clickable
    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();
    
    // Clicking retry button doesn't throw error
    expect(() => fireEvent.click(retryButton)).not.toThrow();
  });

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error Details (Development)')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('shows refresh page button when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Check that refresh button is present
    const refreshButton = screen.getByText('Refresh Page');
    expect(refreshButton).toBeInTheDocument();
    
    // Button should be clickable (we can't easily test window.location.reload in Jest)
    expect(refreshButton).not.toBeDisabled();
  });
});

describe('withErrorBoundary HOC', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('wraps component with error boundary', () => {
    const WrappedComponent = withErrorBoundary(ThrowError);
    
    render(<WrappedComponent shouldThrow={false} />);
    
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('catches errors in wrapped component', () => {
    const WrappedComponent = withErrorBoundary(ThrowError);
    
    render(<WrappedComponent shouldThrow={true} />);
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('uses custom fallback in HOC', () => {
    const CustomFallback = <div>HOC Custom Error</div>;
    const WrappedComponent = withErrorBoundary(ThrowError, CustomFallback);
    
    render(<WrappedComponent shouldThrow={true} />);
    
    expect(screen.getByText('HOC Custom Error')).toBeInTheDocument();
  });
});

describe('useErrorHandler hook', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('logs errors to console', () => {
    render(<TestHookComponent />);
    
    const button = screen.getByText('Trigger Error');
    fireEvent.click(button);
    
    expect(console.error).toHaveBeenCalledWith(
      'Error in test-component:',
      expect.any(Error)
    );
  });

  it('handles errors without context', () => {
    const TestComponent = () => {
      const handleError = useErrorHandler();
      
      const triggerError = () => {
        handleError(new Error('No context error'));
      };
      
      return <button onClick={triggerError}>Trigger Error</button>;
    };
    
    render(<TestComponent />);
    
    const button = screen.getByText('Trigger Error');
    fireEvent.click(button);
    
    expect(console.error).toHaveBeenCalledWith(
      'Error in component:',
      expect.any(Error)
    );
  });
});