import React, { useState } from 'react';
import { X, Save, Trash2, Plus, Calendar, User } from 'lucide-react';
import type { Scenario } from '../data/mockData';

interface ScenarioPanelProps {
  scenarios: Scenario[];
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  onLoad: (scenario: Scenario) => void;
  onDelete: (id: string) => void;
  isInPlanningMode: boolean;
}

export function ScenarioPanel({
  scenarios,
  onClose,
  onSave,
  onLoad,
  onDelete,
  isInPlanningMode
}: ScenarioPanelProps) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');

  const handleSave = () => {
    if (scenarioName.trim()) {
      onSave(scenarioName.trim(), scenarioDescription.trim());
      setScenarioName('');
      setScenarioDescription('');
      setShowSaveForm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Scenario Management</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isInPlanningMode && (
            <div className="mb-6">
              {!showSaveForm ? (
                <button
                  onClick={() => setShowSaveForm(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Save Current Plan</span>
                </button>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plan Name *
                    </label>
                    <input
                      type="text"
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder="e.g. Q4 Reorganization"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={scenarioDescription}
                      onChange={(e) => setScenarioDescription(e.target.value)}
                      placeholder="Optional description..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setShowSaveForm(false)}
                      className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!scenarioName.trim()}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Saved Plans ({scenarios.length})
            </h3>
            
            {scenarios.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Save className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No plans saved yet.</p>
                <p className="text-sm">Enter planning mode to create and save organizational plans.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-gray-900">
                          {scenario.name}
                        </h4>
                        {scenario.description && (
                          <p className="text-gray-600 mt-1">{scenario.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(scenario.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <User className="h-4 w-4" />
                            <span>{scenario.createdBy}</span>
                          </div>
                          <span>{scenario.employees.length} employees</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => onLoad(scenario)}
                          className="px-3 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => onDelete(scenario.id)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}