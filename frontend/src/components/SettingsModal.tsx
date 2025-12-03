import React, { useRef, useEffect } from 'react';
import { X, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import { AzureConfig } from '../types/azureConfig';

interface SettingsModalProps {
  currentConfig: AzureConfig | null;
  isUsingMockData: boolean;
  onClose: () => void;
}

export function SettingsModal({
  currentConfig,
  isUsingMockData,
  onClose
}: SettingsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle outside click and escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Configuration Status */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Azure AD Configuration</h3>
            {isUsingMockData ? (
              <div className="flex items-center text-orange-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">Using demo data</span>
              </div>
            ) : currentConfig ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-green-600 mb-3">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  <span>Connected to Azure AD</span>
                </div>
                <div className="text-gray-600">
                  <div className="mb-1">
                    <span className="font-medium">Tenant:</span>{' '}
                    <span className="font-mono text-xs">{currentConfig.tenantId}</span>
                  </div>
                  <div>
                    <span className="font-medium">Client ID:</span>{' '}
                    <span className="font-mono text-xs">{currentConfig.clientId}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">No configuration found</span>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center">
            Configuration is managed via environment variables.
          </p>

          <button
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
