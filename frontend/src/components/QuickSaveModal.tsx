import React, { useState, useRef, useEffect } from 'react';
import { Save, X, Trash2, Calendar } from 'lucide-react';
import type { Scenario } from '../data/mockData';

interface QuickSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  onDelete?: (scenarioId: string) => void;
  scenarios?: Scenario[];
}

export function QuickSaveModal({ isOpen, onClose, onSave, onDelete, scenarios = [] }: QuickSaveModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Debug logging
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 QuickSaveModal opened with scenarios:', scenarios.length, scenarios.map(s => s.name));
    }
  }, [isOpen, scenarios]);

  // Handle outside click and escape key
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      onSave(name.trim(), description.trim());
      onClose();
      // Reset form
      setName('');
      setDescription('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    onClose();
    setName('');
    setDescription('');
    setSelectedScenario(null);
  };

  const handleScenarioSelect = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setName(scenario.name);
    setDescription(scenario.description);
  };

  const handleNewScenario = () => {
    setSelectedScenario(null);
    setName('');
    setDescription('');
  };

  const handleDelete = (scenarioId: string) => {
    if (onDelete) {
      onDelete(scenarioId);
      if (selectedScenario?.id === scenarioId) {
        handleNewScenario();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Save className="h-5 w-5 text-green-600" />
            Save Scenario
          </h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Existing Scenarios */}
          {scenarios.length > 0 && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Existing Scenarios</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedScenario?.id === scenario.id
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => handleScenarioSelect(scenario)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{scenario.name}</p>
                        <p className="text-sm text-gray-500">{scenario.description}</p>
                      </div>
                      {onDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(scenario.id);
                          }}
                          className="ml-2 p-1 text-red-400 hover:text-red-600 transition-colors"
                          title="Delete scenario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <button
                type="button"
                onClick={handleNewScenario}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                + Create New Scenario
              </button>
            </div>
          )}

          {/* Save Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="scenario-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Scenario Name *
                </label>
                <input
                  id="scenario-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Q3 Reorganization, Team Expansion"
                  disabled={isSaving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                  autoFocus
                  maxLength={100}
                />
              </div>

              <div>
                <label htmlFor="scenario-description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="scenario-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the changes made..."
                  disabled={isSaving}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                  maxLength={500}
                />
              </div>

              <div className="text-sm text-gray-500">
                {selectedScenario ? 
                  'This will overwrite the selected scenario with your current changes.' :
                  'This will save your current org chart changes as a new scenario.'
                }
              </div>
            </div>
          </form>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
              disabled={!name.trim() || isSaving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Scenario
                </>
              )}
            </button>
          </div>
      </div>
    </div>
  );
}