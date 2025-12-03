import React from 'react';
import { X, GitCompare, UserMinus, UserPlus, Edit3, Palette, ArrowRight } from 'lucide-react';
import type { Employee } from '../data/mockData';

interface Change {
  type: 'reassignment' | 'title_change' | 'color_change' | 'new_position' | 'deleted';
  employee: Employee;
  originalValue?: string;
  newValue?: string;
  originalManagerName?: string;
  newManagerName?: string;
}

interface ChangeSummaryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  baseEmployees: Employee[];
  reassignedEmployeeIds: Set<string>;
  onEmployeeClick?: (employee: Employee) => void;
}

export function ChangeSummaryPanel({
  isOpen,
  onClose,
  employees,
  baseEmployees,
  reassignedEmployeeIds,
  onEmployeeClick
}: ChangeSummaryPanelProps) {
  if (!isOpen) return null;

  // Calculate all changes
  const changes: Change[] = [];

  // Helper to get employee name by ID
  const getEmployeeName = (id: string | undefined, list: Employee[]): string => {
    if (!id) return '(No Manager)';
    const emp = list.find(e => e.id === id);
    return emp?.name || '(Unknown)';
  };

  // Find reassignments
  reassignedEmployeeIds.forEach(empId => {
    const current = employees.find(e => e.id === empId);
    const original = baseEmployees.find(e => e.id === empId);
    if (current && original) {
      changes.push({
        type: 'reassignment',
        employee: current,
        originalValue: original.managerId,
        newValue: current.managerId,
        originalManagerName: getEmployeeName(original.managerId, baseEmployees),
        newManagerName: getEmployeeName(current.managerId, employees)
      });
    }
  });

  // Find title changes (not already counted as reassignment)
  employees.forEach(current => {
    const original = baseEmployees.find(e => e.id === current.id);
    if (original && original.title !== current.title) {
      changes.push({
        type: 'title_change',
        employee: current,
        originalValue: original.title,
        newValue: current.title
      });
    }
  });

  // Find color changes
  employees.forEach(current => {
    const original = baseEmployees.find(e => e.id === current.id);
    if (original && original.customColor !== current.customColor && current.customColor) {
      changes.push({
        type: 'color_change',
        employee: current,
        originalValue: original.customColor || 'default',
        newValue: current.customColor
      });
    }
  });

  // Find new positions (employees in current but not in base)
  employees.forEach(current => {
    const original = baseEmployees.find(e => e.id === current.id);
    if (!original && current.id.startsWith('open-')) {
      changes.push({
        type: 'new_position',
        employee: current,
        newManagerName: getEmployeeName(current.managerId, employees)
      });
    }
  });

  // Group changes by type
  const reassignments = changes.filter(c => c.type === 'reassignment');
  const titleChanges = changes.filter(c => c.type === 'title_change');
  const colorChanges = changes.filter(c => c.type === 'color_change');
  const newPositions = changes.filter(c => c.type === 'new_position');

  const totalChanges = changes.length;

  // Calculate headcount summary
  const getHeadcountByDepartment = (empList: Employee[]) => {
    const counts: Record<string, number> = {};
    empList.forEach(emp => {
      const dept = emp.department || 'Unknown';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return counts;
  };

  const baseCounts = getHeadcountByDepartment(baseEmployees);
  const currentCounts = getHeadcountByDepartment(employees);
  const allDepartments = [...new Set([...Object.keys(baseCounts), ...Object.keys(currentCounts)])].sort();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <GitCompare className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Change Summary</h2>
              <p className="text-sm text-gray-500">
                {totalChanges === 0 ? 'No changes made' : `${totalChanges} change${totalChanges !== 1 ? 's' : ''} in this plan`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {totalChanges === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <GitCompare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No changes have been made yet.</p>
              <p className="text-sm mt-1">Drag employees to new managers or edit their details to see changes here.</p>
            </div>
          ) : (
            <>
              {/* Reassignments */}
              {reassignments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <UserPlus className="w-4 h-4 mr-2 text-orange-500" />
                    Manager Changes ({reassignments.length})
                  </h3>
                  <div className="space-y-2">
                    {reassignments.map((change, idx) => (
                      <div
                        key={`reassign-${idx}`}
                        onClick={() => onEmployeeClick?.(change.employee)}
                        className="bg-orange-50 border border-orange-200 rounded-lg p-3 cursor-pointer hover:bg-orange-100 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{change.employee.name}</div>
                        <div className="text-sm text-gray-600 flex items-center mt-1">
                          <span className="text-orange-600">{change.originalManagerName}</span>
                          <ArrowRight className="w-4 h-4 mx-2 text-gray-400" />
                          <span className="text-green-600 font-medium">{change.newManagerName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Title Changes */}
              {titleChanges.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <Edit3 className="w-4 h-4 mr-2 text-blue-500" />
                    Title Changes ({titleChanges.length})
                  </h3>
                  <div className="space-y-2">
                    {titleChanges.map((change, idx) => (
                      <div
                        key={`title-${idx}`}
                        onClick={() => onEmployeeClick?.(change.employee)}
                        className="bg-blue-50 border border-blue-200 rounded-lg p-3 cursor-pointer hover:bg-blue-100 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{change.employee.name}</div>
                        <div className="text-sm text-gray-600 flex items-center mt-1">
                          <span className="line-through text-gray-400">{change.originalValue}</span>
                          <ArrowRight className="w-4 h-4 mx-2 text-gray-400" />
                          <span className="text-blue-600 font-medium">{change.newValue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Positions */}
              {newPositions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <UserPlus className="w-4 h-4 mr-2 text-green-500" />
                    New Positions ({newPositions.length})
                  </h3>
                  <div className="space-y-2">
                    {newPositions.map((change, idx) => (
                      <div
                        key={`new-${idx}`}
                        onClick={() => onEmployeeClick?.(change.employee)}
                        className="bg-green-50 border border-green-200 rounded-lg p-3 cursor-pointer hover:bg-green-100 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{change.employee.name}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {change.employee.title} • Reports to {change.newManagerName}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Changes */}
              {colorChanges.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                    <Palette className="w-4 h-4 mr-2 text-purple-500" />
                    Color Tags ({colorChanges.length})
                  </h3>
                  <div className="space-y-2">
                    {colorChanges.map((change, idx) => (
                      <div
                        key={`color-${idx}`}
                        onClick={() => onEmployeeClick?.(change.employee)}
                        className="bg-purple-50 border border-purple-200 rounded-lg p-3 cursor-pointer hover:bg-purple-100 transition-colors"
                      >
                        <div className="font-medium text-gray-900 flex items-center">
                          {change.employee.name}
                          <span
                            className="ml-2 w-4 h-4 rounded-full border border-gray-300"
                            style={{ backgroundColor: change.newValue }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Headcount Summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Headcount by Department
                </h3>
                <div className="bg-gray-50 rounded-lg p-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left pb-2">Department</th>
                        <th className="text-right pb-2">Before</th>
                        <th className="text-right pb-2">After</th>
                        <th className="text-right pb-2">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allDepartments.map(dept => {
                        const before = baseCounts[dept] || 0;
                        const after = currentCounts[dept] || 0;
                        const diff = after - before;
                        return (
                          <tr key={dept} className="border-t border-gray-200">
                            <td className="py-1">{dept}</td>
                            <td className="text-right py-1">{before}</td>
                            <td className="text-right py-1">{after}</td>
                            <td className={`text-right py-1 font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {diff > 0 ? `+${diff}` : diff === 0 ? '-' : diff}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-gray-300 font-semibold">
                        <td className="py-1">Total</td>
                        <td className="text-right py-1">{baseEmployees.length}</td>
                        <td className="text-right py-1">{employees.length}</td>
                        <td className={`text-right py-1 ${employees.length - baseEmployees.length > 0 ? 'text-green-600' : employees.length - baseEmployees.length < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {employees.length - baseEmployees.length > 0 ? `+${employees.length - baseEmployees.length}` : employees.length - baseEmployees.length === 0 ? '-' : employees.length - baseEmployees.length}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
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
