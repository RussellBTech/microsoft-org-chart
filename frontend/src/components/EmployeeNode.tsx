import React from 'react';
import { ChevronDown, ChevronRight, User, Mail, Phone, MoreVertical, ArrowRightLeft, Users } from 'lucide-react';
import type { Employee } from '../data/mockData';
import { getCardColorStyles } from './ColorPicker';
import { QuickColorPicker } from './QuickColorPicker';

type DisplayMode = 'horizontal' | 'vertical' | 'collapsed';

interface EmployeeNodeProps {
  employee: Employee;
  level: number;
  hasChildren: boolean;
  displayMode: DisplayMode;
  isHighlighted?: boolean;
  isCenterPerson?: boolean;
  wasMoved?: boolean;
  originalManagerId?: string | null;
  isDraggedOver: boolean;
  directReportsCount?: number;
  totalTeamSize?: number;
  onSelect: (employee: Employee) => void;
  onDragStart: (employee: Employee) => void;
  onDragEnd: () => void;
  onDrop: (employee: Employee) => void;
  onToggleDisplayMode: (employeeId: string) => void;
  onColorChange?: (employeeId: string, color: string | undefined) => void;
  isSandboxMode: boolean;
}

export function EmployeeNode({
  employee,
  level,
  hasChildren,
  displayMode,
  isHighlighted,
  isCenterPerson,
  wasMoved = false,
  directReportsCount = 0,
  totalTeamSize = 0,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrop,
  onToggleDisplayMode,
  onColorChange,
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

  // Department-based color coding
  const getDepartmentColor = (department: string) => {
    const colors = {
      'Executive': 'bg-purple-50 border-purple-200',
      'Technology': 'bg-blue-50 border-blue-200',
      'Finance': 'bg-green-50 border-green-200',
      'Sales': 'bg-orange-50 border-orange-200',
      'Marketing': 'bg-pink-50 border-pink-200',
      'Human Resources': 'bg-yellow-50 border-yellow-200',
      'Product': 'bg-indigo-50 border-indigo-200'
    };
    return colors[department as keyof typeof colors] || 'bg-gray-50 border-gray-200';
  };

  const showTeamMetrics = hasChildren && (directReportsCount > 0 || totalTeamSize > 0);

  // Get color styles - custom color takes priority, then department, then default
  const colorStyles = getCardColorStyles(employee.customColor);
  const departmentColorClass = getDepartmentColor(employee.department);
  
  // Determine the card styling with proper priority:
  // 1. Center person (purple) - highest priority
  // 2. Highlighted/search (blue)
  // 3. Custom color (if set)
  // 4. Department color
  // 5. Moved indicator (orange) - shown as ring only
  // 6. Default styling
  
  const getCardClasses = () => {
    const baseClass = `rounded-lg shadow-sm border p-3 w-52 transition-all duration-200 hover:shadow-md ${isSandboxMode ? 'cursor-move' : 'cursor-pointer'} relative`;
    
    if (isCenterPerson) {
      return `${baseClass} ring-2 ring-purple-500 bg-purple-50 border-purple-300`;
    }
    if (isHighlighted) {
      return `${baseClass} ring-2 ring-blue-500 bg-blue-50 border-blue-300`;
    }
    if (employee.customColor) {
      // If moved AND has custom color, show custom color with orange ring
      if (wasMoved && isSandboxMode) {
        return `${baseClass} ${colorStyles.background} ${colorStyles.border} ring-2 ring-orange-400`;
      }
      return `${baseClass} ${colorStyles.background} ${colorStyles.border} ${colorStyles.hover}`;
    }
    if (wasMoved && isSandboxMode) {
      return `${baseClass} ring-2 ring-orange-400 ${departmentColorClass}`;
    }
    
    // Use department colors for better visual organization
    return `${baseClass} ${departmentColorClass} hover:shadow-lg`;
  };
  
  return (
    <div
      className={getCardClasses()}
      draggable={isSandboxMode}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => onSelect(employee)}
    >
      {/* Status indicators and quick actions */}
      <div className="absolute -top-2 -right-2 flex space-x-1">
        {/* Quick color picker - only in sandbox mode */}
        {isSandboxMode && onColorChange && (
          <div className="bg-white rounded-full p-1 shadow-md z-20">
            <QuickColorPicker
              currentColor={employee.customColor}
              onColorChange={(color) => onColorChange(employee.id, color)}
              disabled={!isSandboxMode}
            />
          </div>
        )}
        
        {/* Moved indicator badge */}
        {wasMoved && isSandboxMode && (
          <div className="bg-orange-500 text-white rounded-full p-1 shadow-md z-20" title="Employee has been reassigned">
            <ArrowRightLeft className="h-3 w-3" />
          </div>
        )}
        
      </div>
      
      {hasChildren && (
        <button
          className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 z-10 group"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDisplayMode(employee.id);
          }}
          title={`Click to change layout (current: ${displayMode})`}
        >
          {displayMode === 'collapsed' ? (
            <ChevronRight className="h-3 w-3 text-gray-600" />
          ) : displayMode === 'vertical' ? (
            <MoreVertical className="h-3 w-3 text-gray-600" />
          ) : (
            <ChevronDown className="h-3 w-3 text-gray-600" />
          )}
          {/* Tooltip on hover */}
          <span className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            {displayMode === 'horizontal' ? 'Switch to vertical' : 
             displayMode === 'vertical' ? 'Collapse' : 
             'Expand horizontal'}
          </span>
        </button>
      )}
      
      <div className="flex items-start space-x-2.5">
        <div className="flex-shrink-0">
          {employee.avatar ? (
            <img
              src={employee.avatar}
              alt={employee.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-500" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {employee.name}
          </h3>
          <p className="text-xs text-gray-600 truncate">{employee.title}</p>
          
          <div className="mt-1.5 space-y-1">
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
            
            {/* Team metrics for managers */}
            {showTeamMetrics && (
              <div className="mt-1.5 pt-1.5 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1 text-blue-600">
                    <Users className="h-3 w-3" />
                    <span>{directReportsCount} direct</span>
                  </div>
                  {totalTeamSize > directReportsCount && (
                    <div className="text-gray-500">
                      <span>{totalTeamSize} total</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Department badge */}
            <div className="mt-1.5">
              <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                employee.department === 'Executive' ? 'bg-purple-100 text-purple-700' :
                employee.department === 'Technology' ? 'bg-blue-100 text-blue-700' :
                employee.department === 'Finance' ? 'bg-green-100 text-green-700' :
                employee.department === 'Sales' ? 'bg-orange-100 text-orange-700' :
                employee.department === 'Marketing' ? 'bg-pink-100 text-pink-700' :
                employee.department === 'Human Resources' ? 'bg-yellow-100 text-yellow-700' :
                employee.department === 'Product' ? 'bg-indigo-100 text-indigo-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {employee.department}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}