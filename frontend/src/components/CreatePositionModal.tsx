import React, { useState, useRef, useEffect } from 'react';
import { X, UserPlus } from 'lucide-react';
import type { Employee } from '../data/mockData';

interface CreatePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (managerId: string, title: string, department: string) => void;
  employees: Employee[];
  preselectedManagerId?: string;
}

const DEPARTMENTS = [
  'Executive',
  'Technology',
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Finance',
  'Human Resources',
  'Operations',
  'Legal',
  'Customer Success',
  'Other'
];

export function CreatePositionModal({
  isOpen,
  onClose,
  onCreate,
  employees,
  preselectedManagerId
}: CreatePositionModalProps) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [managerId, setManagerId] = useState(preselectedManagerId || '');
  const [managerSearch, setManagerSearch] = useState('');
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const managerInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDepartment('');
      setManagerId(preselectedManagerId || '');
      setManagerSearch('');
      if (preselectedManagerId) {
        const manager = employees.find(e => e.id === preselectedManagerId);
        if (manager) {
          setManagerSearch(manager.name);
        }
      }
    }
  }, [isOpen, preselectedManagerId, employees]);

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

  // Filter employees for manager search
  const filteredManagers = employees
    .filter(emp =>
      !emp.id.startsWith('open-') &&
      emp.name.toLowerCase().includes(managerSearch.toLowerCase())
    )
    .slice(0, 10);

  const handleSelectManager = (employee: Employee) => {
    setManagerId(employee.id);
    setManagerSearch(employee.name);
    setShowManagerDropdown(false);
    // Auto-fill department from manager if not already set
    if (!department && employee.department) {
      setDepartment(employee.department);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !managerId) return;

    onCreate(managerId, title.trim(), department || 'Other');
    onClose();
  };

  const isValid = title.trim() && managerId;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={modalRef} className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <UserPlus className="w-6 h-6 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Create Open Position</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Senior Software Engineer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              autoFocus
            />
          </div>

          {/* Reports To */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reports To <span className="text-red-500">*</span>
            </label>
            <input
              ref={managerInputRef}
              type="text"
              value={managerSearch}
              onChange={(e) => {
                setManagerSearch(e.target.value);
                setShowManagerDropdown(true);
                if (!e.target.value) setManagerId('');
              }}
              onFocus={() => setShowManagerDropdown(true)}
              placeholder="Search for manager..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            {showManagerDropdown && managerSearch && filteredManagers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredManagers.map(emp => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectManager(emp)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex flex-col"
                  >
                    <span className="font-medium text-gray-900">{emp.name}</span>
                    <span className="text-sm text-gray-500">{emp.title}</span>
                  </button>
                ))}
              </div>
            )}
            {managerId && (
              <p className="mt-1 text-xs text-green-600">
                ✓ Selected: {employees.find(e => e.id === managerId)?.name}
              </p>
            )}
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select department...</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Note:</strong> Open positions are placeholders that can be filled or reorganized during planning. They will be included in exports and scenarios.
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Create Position
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
