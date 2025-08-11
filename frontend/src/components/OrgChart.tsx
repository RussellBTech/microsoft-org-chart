import React, { useState, useRef, useCallback } from 'react';
import { EmployeeNode } from './EmployeeNode';
import { ZoomControls } from './ZoomControls';
import type { Employee } from '../data/mockData';

interface OrgChartProps {
  employees: Employee[];
  searchTerm: string;
  isSandboxMode: boolean;
  centerPersonId?: string;
  onEmployeeSelect: (employee: Employee) => void;
  onEmployeeReassign: (employeeId: string, newManagerId: string | null) => void;
}

export function OrgChart({
  employees,
  searchTerm,
  isSandboxMode,
  centerPersonId,
  onEmployeeSelect,
  onEmployeeReassign
}: OrgChartProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggedEmployee, setDraggedEmployee] = useState<Employee | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Build hierarchy
  const buildHierarchy = useCallback((employees: Employee[]) => {
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
    const rootEmployees: Employee[] = [];
    const childrenMap = new Map<string, Employee[]>();

    // First, build the children map
    employees.forEach(emp => {
      if (emp.managerId) {
        const children = childrenMap.get(emp.managerId) || [];
        children.push(emp);
        childrenMap.set(emp.managerId, children);
      }
    });

    // Find root employees (those without managers OR whose managers don't exist in the dataset)
    employees.forEach(emp => {
      if (!emp.managerId) {
        // No manager ID means this is a root
        rootEmployees.push(emp);
      } else if (!employeeMap.has(emp.managerId)) {
        // Manager ID exists but manager is not in the dataset - treat as root
        console.log(`Employee ${emp.name} has manager ID ${emp.managerId} that doesn't exist in dataset - treating as root`);
        rootEmployees.push(emp);
      }
    });

    // If no root found (circular references), find employees who are managers but not managed
    if (rootEmployees.length === 0 && employees.length > 0) {
      console.warn('No clear root found - looking for employees who manage others but aren\'t in anyone\'s reports');
      
      const managedEmployees = new Set<string>();
      employees.forEach(emp => {
        if (emp.managerId && employeeMap.has(emp.managerId)) {
          managedEmployees.add(emp.id);
        }
      });
      
      employees.forEach(emp => {
        if (!managedEmployees.has(emp.id) && childrenMap.has(emp.id)) {
          // This person manages others but isn't managed by anyone in the dataset
          rootEmployees.push(emp);
        }
      });
    }

    // Final fallback: just pick the first employee if still no root
    if (rootEmployees.length === 0 && employees.length > 0) {
      console.warn('Could not determine hierarchy root - using first employee');
      rootEmployees.push(employees[0]);
    }

    console.log(`Found ${rootEmployees.length} root employee(s):`, rootEmployees.map(e => e.name));

    return { rootEmployees, childrenMap, employeeMap };
  }, []);

  const { rootEmployees, childrenMap } = buildHierarchy(employees);

  const handleDragStart = (employee: Employee) => {
    if (!isSandboxMode) return;
    setDraggedEmployee(employee);
  };

  const handleDragEnd = () => {
    setDraggedEmployee(null);
  };

  const handleDrop = (targetEmployee: Employee) => {
    if (!draggedEmployee || !isSandboxMode || draggedEmployee.id === targetEmployee.id) return;
    
    // Prevent circular references
    let current = targetEmployee;
    while (current.managerId) {
      if (current.managerId === draggedEmployee.id) return;
      current = employees.find(emp => emp.id === current.managerId)!;
    }
    
    onEmployeeReassign(draggedEmployee.id, targetEmployee.id);
    setDraggedEmployee(null);
  };

  const toggleCollapse = (employeeId: string) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const renderEmployeeTree = (employee: Employee, level: number = 0): JSX.Element => {
    const children = childrenMap.get(employee.id) || [];
    const isCollapsed = collapsedNodes.has(employee.id);
    const hasChildren = children.length > 0;
    const isHighlighted = searchTerm && (
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const isCenterPerson = centerPersonId === employee.id;

    return (
      <div key={employee.id} className="flex flex-col items-center">
        {/* Employee Node */}
        <div className="relative">
          <EmployeeNode
            employee={employee}
            level={level}
            hasChildren={hasChildren}
            isCollapsed={isCollapsed}
            isHighlighted={isHighlighted}
            isCenterPerson={isCenterPerson}
            isDraggedOver={draggedEmployee?.id !== employee.id}
            onSelect={onEmployeeSelect}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onToggleCollapse={toggleCollapse}
            isSandboxMode={isSandboxMode}
          />
        </div>
        
        {/* Connection Lines and Children */}
        {hasChildren && !isCollapsed && children.length > 0 && (
          <div className="flex flex-col items-center mt-6">
            {/* Vertical line down from parent */}
            <div className="w-0.5 h-6 bg-gray-300"></div>
            
            {/* Horizontal line across children */}
            {children.length > 1 && (
              <div className="relative">
                <div className="h-0.5 bg-gray-300" style={{ width: `${(children.length - 1) * 280 + 120}px` }}></div>
                {/* Vertical lines down to each child */}
                {children.map((_, index) => (
                  <div
                    key={index}
                    className="absolute top-0 w-0.5 h-6 bg-gray-300"
                    style={{ left: `${index * 280 + 60}px` }}
                  ></div>
                ))}
              </div>
            )}
            
            {/* Single vertical line for single child */}
            {children.length === 1 && (
              <div className="w-0.5 h-6 bg-gray-300"></div>
            )}
            
            {/* Children nodes */}
            <div className="flex items-start justify-center gap-8 mt-6">
              {children.map(child => (
                <div key={child.id} className="flex-shrink-0">
                  {renderEmployeeTree(child, level + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative h-full overflow-hidden bg-gray-50">
      <ZoomControls
        zoom={zoom}
        onZoomIn={() => setZoom(z => Math.min(z + 0.1, 2))}
        onZoomOut={() => setZoom(z => Math.max(z - 0.1, 0.3))}
        onReset={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
      />
      
      <div
        ref={containerRef}
        className="h-full overflow-auto p-12"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left'
        }}
      >
        <div className="flex flex-col items-center min-w-max">
          {rootEmployees.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-8">
              <p className="text-yellow-700">No organizational hierarchy could be determined. This might happen if:</p>
              <ul className="list-disc list-inside mt-2 text-sm text-yellow-600">
                <li>The data doesn't include manager relationships</li>
                <li>There are circular reporting structures</li>
                <li>The CEO/top person is not included in the data</li>
              </ul>
            </div>
          ) : rootEmployees.length > 1 ? (
            <div className="flex flex-wrap gap-12 justify-center">
              {rootEmployees.map(employee => (
                <div key={employee.id} className="flex flex-col items-center">
                  <div className="text-sm text-gray-500 mb-2">Organization Tree</div>
                  {renderEmployeeTree(employee)}
                </div>
              ))}
            </div>
          ) : (
            rootEmployees.map(employee => renderEmployeeTree(employee))
          )}
        </div>
      </div>
      
      {employees.length > 5000 && (
        <div className="absolute top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-700">
            Large dataset detected ({employees.length} employees). Performance may be affected.
          </p>
        </div>
      )}
    </div>
  );
}