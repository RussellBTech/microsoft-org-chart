import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import type { Employee } from '../data/mockData';
import { getCardColorStyles, getColorHex } from './ColorPicker';

interface SearchPanelProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  employees: Employee[];
  onEmployeeSelect: (employee: Employee) => void;
}

export function SearchPanel({
  searchTerm,
  onSearchChange,
  employees,
  onEmployeeSelect
}: SearchPanelProps) {
  const [showFilters, setShowFilters] = React.useState(false);
  const [departmentFilter, setDepartmentFilter] = React.useState('');
  const [titleFilter, setTitleFilter] = React.useState('');

  const departments = [...new Set(employees.map(emp => emp.department))].sort();

  const filteredEmployees = employees.filter(emp => {
    const matchesDepartment = !departmentFilter || emp.department === departmentFilter;
    const matchesTitle = !titleFilter || emp.title.toLowerCase().includes(titleFilter.toLowerCase());
    return matchesDepartment && matchesTitle;
  });

  return (
    <div className="w-full h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="mt-3 flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <Filter className="h-4 w-4" />
          <span>Advanced Filters</span>
        </button>
      </div>

      {showFilters && (
        <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Title Contains
            </label>
            <input
              type="text"
              placeholder="e.g. Manager, Director..."
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {(departmentFilter || titleFilter) && (
            <button
              onClick={() => {
                setDepartmentFilter('');
                setTitleFilter('');
              }}
              className="flex items-center space-x-1 text-xs text-red-600 hover:text-red-700"
            >
              <X className="h-3 w-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="text-sm text-gray-600 mb-3">
            {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''} found
          </div>
          
          <div className="space-y-2">
            {filteredEmployees.map(employee => (
              <div
                key={employee.id}
                onClick={() => onEmployeeSelect(employee)}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-colors relative
                  ${employee.customColor ? 
                    `${getCardColorStyles(employee.customColor).background} ${getCardColorStyles(employee.customColor).border} ${getCardColorStyles(employee.customColor).hover}` :
                    'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }
                `}
              >
                {/* Color indicator dot */}
                {employee.customColor && (
                  <div className="absolute top-2 right-2 w-3 h-3 rounded-full shadow-sm"
                       style={{ backgroundColor: getColorHex(employee.customColor) }}
                       title={`Custom color: ${employee.customColor}`}>
                  </div>
                )}
                
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">
                      {employee.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {employee.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {employee.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {employee.department}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}