import React from 'react';
import { Users, Search, Loader2, User } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  submessage?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

function LoadingState({ 
  message = "Loading...", 
  submessage, 
  size = 'md', 
  icon 
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const containerClasses = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${containerClasses[size]}`}>
      <div className="flex items-center space-x-3">
        {icon || <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />}
        <div className="text-center">
          <div className="text-lg font-medium text-gray-900">{message}</div>
          {submessage && (
            <div className="text-sm text-gray-500 mt-1">{submessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuthenticatingState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <LoadingState 
        message="Authenticating..."
        submessage="Signing in to your Microsoft account"
        size="lg"
        icon={<User className="h-12 w-12 animate-pulse text-blue-600" />}
      />
    </div>
  );
}

export function LoadingOrgData() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <LoadingState 
        message="Loading Organization Data"
        submessage="Fetching your team structure from Microsoft Graph"
        size="lg"
        icon={<Users className="h-12 w-12 animate-pulse text-blue-600" />}
      />
    </div>
  );
}


export function LoadingSearch() {
  return (
    <div className="flex items-center justify-center py-8">
      <LoadingState 
        message="Searching..."
        submessage="Finding people in your organization"
        size="sm"
        icon={<Search className="h-6 w-6 animate-pulse text-blue-600" />}
      />
    </div>
  );
}

export function LoadingUserContext({ userName }: { userName?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <LoadingState 
        message={`Loading ${userName ? `${userName}'s` : 'User'} Context`}
        submessage="Fetching organizational relationships"
        icon={<User className="h-8 w-8 animate-pulse text-blue-600" />}
      />
    </div>
  );
}


// Inline loading spinner for buttons and small components
export function InlineSpinner({ size = 'sm' }: { size?: 'xs' | 'sm' | 'md' }) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4', 
    md: 'h-5 w-5'
  };

  return (
    <Loader2 className={`${sizeClasses[size]} animate-spin`} />
  );
}

// Loading overlay for existing content
export function LoadingOverlay({ 
  message = "Loading...", 
  isVisible = false 
}: { 
  message?: string; 
  isVisible: boolean; 
}) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-40">
      <LoadingState message={message} />
    </div>
  );
}

// Loading state for the entire org chart area
export function LoadingOrgChart() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <LoadingState 
        message="Building Organization Chart"
        submessage="Processing hierarchical relationships"
        size="lg"
        icon={<Users className="h-12 w-12 animate-bounce text-blue-600" />}
      />
    </div>
  );
}

// Loading skeleton for employee cards
export function EmployeeCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 w-64 animate-pulse">
      <div className="flex items-start space-x-3">
        <div className="w-12 h-12 rounded-full bg-gray-200"></div>
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  );
}

// Progress indicator for multi-step operations
export function ProgressLoader({ 
  steps, 
  currentStep, 
  message 
}: { 
  steps: string[]; 
  currentStep: number; 
  message?: string; 
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div 
              key={index}
              className={`flex-1 text-center ${
                index < currentStep ? 'text-green-600' : 
                index === currentStep ? 'text-blue-600' : 
                'text-gray-400'
              }`}
            >
              <div className={`w-8 h-8 mx-auto rounded-full border-2 flex items-center justify-center mb-2 ${
                index < currentStep ? 'border-green-600 bg-green-600 text-white' :
                index === currentStep ? 'border-blue-600 bg-blue-600 text-white' :
                'border-gray-300'
              }`}>
                {index < currentStep ? '✓' : index + 1}
              </div>
              <div className="text-xs">{step}</div>
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
        {message && (
          <div className="text-center text-gray-600">{message}</div>
        )}
      </div>
    </div>
  );
}