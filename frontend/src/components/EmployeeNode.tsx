import React from 'react';
import { ChevronDown, ChevronRight, User, Mail, Phone } from 'lucide-react';
import type { Employee } from '../data/mockData';

interface EmployeeNodeProps {
  employee: Employee;
  level: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  isHighlighted?: boolean;
  isCenterPerson?: boolean;
  isDraggedOver: boolean;
  onSelect: (employee: Employee) => void;
  onDragStart: (employee: Employee) => void;
  onDragEnd: () => void;
  onDrop: (employee: Employee) => void;
  onToggleCollapse: (employeeId: string) => void;
  isSandboxMode: boolean;
}

export function EmployeeNode({
  employee,
  level,
  hasChildren,
  isCollapsed,
  isHighlighted,
  isCenterPerson,
  isDraggedOver,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrop,
  onToggleCollapse,
  isSandboxMode
}: EmployeeNodeProps) {
  const handleDragStart = (e: React.DragEvent) => {
    if (!isSandboxMode) {
      e.preventDefault();
      return;
    }
    onDragStart(employee);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isSandboxMode) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isSandboxMode) return;
    e.preventDefault();
    onDrop(employee);
  };

  // Count total reports recursively
  const countAllReports = (empId: string): number => {
    // This would need access to the children map, but for now we'll use a placeholder
    return 0; // Will be updated with actual count in parent component
  };
  return (
    <div
      className={`
        bg-white rounded-lg shadow-sm border p-4 w-64
        transition-all duration-200 hover:shadow-md
        ${isCenterPerson ? 'ring-2 ring-purple-500 bg-purple-50 border-purple-300' : 
          isHighlighted ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-300' : 
          'border-gray-200 hover:border-gray-300'}
        ${isSandboxMode ? 'cursor-move' : 'cursor-pointer'}
        relative
      `}
      draggable={isSandboxMode}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => onSelect(employee)}
    >
      {hasChildren && (
        <button
          className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(employee.id);
          }}
        >
          {isCollapsed ? (
            <ChevronDown className="h-3 w-3 text-gray-600 rotate-180" />
          ) : (
            <ChevronDown className="h-3 w-3 text-gray-600" />
          )}
        </button>
      )}
      
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {employee.avatar ? (
            <img
              src={employee.avatar}
              alt={employee.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-6 w-6 text-gray-500" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {employee.name}
          </h3>
          <p className="text-xs text-gray-600 truncate">{employee.title}</p>
          <p className="text-xs text-gray-500 truncate">{employee.department}</p>
          
          <div className="mt-2 space-y-1">
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Mail className="h-3 w-3" />
              <span className="truncate">{employee.email}</span>
            </div>
            {employee.phone && (
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <Phone className="h-3 w-3" />
                <span>{employee.phone}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}