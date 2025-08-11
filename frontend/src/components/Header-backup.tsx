import React from 'react';
import { Search, Settings, Download, RotateCcw, Save, Users, AlertTriangle } from 'lucide-react';
import type { Scenario } from '../data/mockData';

interface HeaderProps {
  isSandboxMode: boolean;
  onToggleSandbox: (enabled: boolean) => void;
  onShowScenarios: () => void;
  onShowExport: () => void;
  onResetToLive: () => void;
  userRole: 'admin' | 'manager' | 'assistant';
  currentScenario: Scenario | null;
}

export function Header({
  isSandboxMode,
  onToggleSandbox,
  onShowScenarios,
  onShowExport,
  onResetToLive,
  userRole,
  currentScenario
}: HeaderProps) {
  const canEdit = userRole === 'admin' || userRole === 'manager';

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Users className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Org Chart Management</h1>
          </div>
          
          {currentScenario && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-full">
              <span className="text-sm text-blue-700 font-medium">
                Scenario: {currentScenario.name}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {isSandboxMode && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-orange-50 rounded-full">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-700 font-medium">Sandbox Mode</span>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            {canEdit && (
              <>
                <button
                  onClick={() => onToggleSandbox(!isSandboxMode)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isSandboxMode
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {isSandboxMode ? 'Exit Sandbox' : 'Enter Sandbox'}
                </button>
                
                <button
                  onClick={onShowScenarios}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Save className="h-4 w-4" />
                  <span>Scenarios</span>
                </button>
              </>
            )}
            
            <button
              onClick={onShowExport}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
            
            {isSandboxMode && canEdit && (
              <button
                onClick={onResetToLive}
                className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset to Live</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}