import React from 'react';
import { Settings, Download, RotateCcw, Save, Users, AlertTriangle, LogIn, LogOut, Undo2, Redo2, GitCompare, UserPlus } from 'lucide-react';
import type { Scenario } from '../data/mockData';

interface HeaderProps {
  isInPlanningMode: boolean;
  onTogglePlanningMode: () => void;
  onShowScenarios: () => void;
  onShowExport: () => void;
  onResetToLive: () => void;
  onShowSettings: () => void;
  onQuickSave?: () => void;
  userRole: 'admin' | 'manager' | 'assistant';
  currentScenario: Scenario | null;
  // Auth props
  isAuthenticated?: boolean;
  user?: { name?: string } | null;
  onLogin?: () => void;
  onLogout?: () => void;
  // Undo/Redo props
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  // Change summary props
  onShowChangeSummary?: () => void;
  changeCount?: number;
  // Create position props
  onCreatePosition?: () => void;
}

export function Header({
  isInPlanningMode,
  onTogglePlanningMode,
  onShowScenarios,
  onShowExport,
  onResetToLive,
  onShowSettings,
  onQuickSave,
  userRole,
  currentScenario,
  isAuthenticated = false,
  user = null,
  onLogin,
  onLogout,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onShowChangeSummary,
  changeCount = 0,
  onCreatePosition
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
          {isInPlanningMode && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-full">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700 font-medium">Planning Mode</span>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            {canEdit && (
              <>
                <button
                  onClick={onTogglePlanningMode}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isInPlanningMode
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {isInPlanningMode ? 'Exit Planning' : 'Start Planning'}
                </button>
                
                {isInPlanningMode ? (
                  <>
                    {/* Undo/Redo buttons */}
                    <div className="flex items-center border-r border-gray-200 pr-2 mr-2">
                      <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="Undo (Ctrl+Z)"
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Undo2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={onRedo}
                        disabled={!canRedo}
                        title="Redo (Ctrl+Y)"
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Redo2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Create Position button */}
                    <button
                      onClick={onCreatePosition}
                      className="flex items-center space-x-2 px-3 py-2 text-green-700 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                      title="Create open position"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>New Position</span>
                    </button>

                    {/* Change Summary button */}
                    <button
                      onClick={onShowChangeSummary}
                      className="flex items-center space-x-2 px-3 py-2 text-blue-700 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View change summary"
                    >
                      <GitCompare className="h-4 w-4" />
                      <span>Changes</span>
                      {changeCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                          {changeCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={onQuickSave}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors font-medium"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save Plan</span>
                    </button>
                    <button
                      onClick={onShowScenarios}
                      className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <span>Manage Plans</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={onShowScenarios}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    <span>Plans</span>
                  </button>
                )}
              </>
            )}
            
            <button
              onClick={onShowExport}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
            
            <button
              onClick={onShowSettings}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
            
            {/* Authentication Button */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                {user?.name && (
                  <span className="text-sm text-gray-600">
                    {user.name}
                  </span>
                )}
                <button
                  onClick={onLogout}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </button>
            )}
            
            {isInPlanningMode && canEdit && (
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