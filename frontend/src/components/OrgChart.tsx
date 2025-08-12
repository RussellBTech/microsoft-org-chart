import React, { useState, useRef, useCallback } from 'react';
import { EmployeeNode } from './EmployeeNode';
import { ZoomControls } from './ZoomControls';
import type { Employee } from '../data/mockData';

interface OrgChartProps {
  employees: Employee[];
  searchTerm: string;
  isSandboxMode: boolean;
  centerPersonId?: string;
  movedEmployeeIds: Set<string>;
  baseEmployees: Employee[];
  onEmployeeSelect: (employee: Employee) => void;
  onEmployeeReassign: (employeeId: string, newManagerId: string | null) => void;
}

type DisplayMode = 'horizontal' | 'vertical' | 'collapsed';

export function OrgChart({
  employees,
  searchTerm,
  isSandboxMode,
  centerPersonId,
  movedEmployeeIds,
  baseEmployees,
  onEmployeeSelect,
  onEmployeeReassign
}: OrgChartProps) {
  console.log('🔍 OrgChart render:', {
    employeeCount: employees.length,
    centerPersonId,
    firstFewEmployees: employees.slice(0, 3).map(e => ({ id: e.id, name: e.name }))
  });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggedEmployee, setDraggedEmployee] = useState<Employee | null>(null);
  const [nodeDisplayModes, setNodeDisplayModes] = useState<Map<string, DisplayMode>>(new Map());
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

  const { rootEmployees: defaultRoots, childrenMap, employeeMap } = buildHierarchy(employees);
  
  // Determine which employees to show as roots based on centerPersonId or view mode
  const rootEmployees = React.useMemo(() => {
    console.log(`🎯 Computing roots - centerPersonId: ${centerPersonId}, has employeeMap: ${employeeMap.size > 0}, defaultRoots: ${defaultRoots.length}`);
    
    // If we have a centerPersonId, focus on that person
    if (centerPersonId) {
      console.log(`Looking for centerPersonId ${centerPersonId} in map of ${employeeMap.size} employees`);
      
      if (!employeeMap.has(centerPersonId)) {
        console.warn(`⚠️ centerPersonId ${centerPersonId} not found in current employee dataset!`);
        console.log('Available IDs:', Array.from(employeeMap.keys()).slice(0, 5));
      } else {
        const centerPerson = employeeMap.get(centerPersonId);
        if (centerPerson) {
          // Check if their manager exists in the current dataset
          if (centerPerson.managerId && employeeMap.has(centerPerson.managerId)) {
            // Show from their manager down (provides context)
            const manager = employeeMap.get(centerPerson.managerId);
            console.log(`🎯 Centering on ${centerPerson.name} - showing from manager ${manager?.name}`);
            return manager ? [manager] : [centerPerson];
          } else {
            // No manager in dataset, show from this person down
            console.log(`🎯 Centering org chart on: ${centerPerson.name} (no manager in dataset)`);
            return [centerPerson];
          }
        }
      }
    }
    
    // For department view without specific center, show all people without managers in this dataset
    // This handles department-specific roots properly
    if (defaultRoots.length > 0) {
      console.log(`📊 No centerPersonId specified - showing ${defaultRoots.length} root(s) for current view`);
      console.log('Default roots:', defaultRoots.map(r => r.name));
      return defaultRoots;
    }
    
    // Fallback to showing all employees if no clear hierarchy
    console.log('⚠️ No clear roots found, showing first employee');
    return employees.length > 0 ? [employees[0]] : [];
  }, [centerPersonId, employeeMap, defaultRoots, employees]);

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

  const toggleDisplayMode = (employeeId: string) => {
    setNodeDisplayModes(prev => {
      const newMap = new Map(prev);
      const currentMode = newMap.get(employeeId) || 'horizontal';
      
      // Cycle through: horizontal → vertical → collapsed → horizontal
      let nextMode: DisplayMode;
      switch (currentMode) {
        case 'horizontal':
          nextMode = 'vertical';
          break;
        case 'vertical':
          nextMode = 'collapsed';
          break;
        case 'collapsed':
          nextMode = 'horizontal';
          break;
        default:
          nextMode = 'horizontal';
      }
      
      newMap.set(employeeId, nextMode);
      return newMap;
    });
  };

  const renderEmployeeTree = (employee: Employee, level: number = 0): JSX.Element => {
    const children = childrenMap.get(employee.id) || [];
    const hasChildren = children.length > 0;
    
    // Determine default display mode based on level
    const isDeepestLevel = level >= 2;
    const defaultMode: DisplayMode = (isDeepestLevel && hasChildren) ? 'vertical' : 'horizontal';
    
    // Get the actual display mode (use default if not set)
    const displayMode = nodeDisplayModes.get(employee.id) || defaultMode;
    const isCollapsed = displayMode === 'collapsed';
    
    const isHighlighted = searchTerm && (
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const isCenterPerson = centerPersonId === employee.id;
    
    // Check if employee was moved in sandbox
    const wasMoved = movedEmployeeIds.has(employee.id);
    const originalEmployee = baseEmployees.find(e => e.id === employee.id);
    
    // Use the display mode to determine rendering
    const shouldRenderVertically = displayMode === 'vertical';

    return (
      <div key={employee.id} className="flex flex-col items-center">
        {/* Employee Node */}
        <div className="relative">
          <EmployeeNode
            employee={employee}
            level={level}
            hasChildren={hasChildren}
            displayMode={displayMode}
            isHighlighted={isHighlighted}
            isCenterPerson={isCenterPerson}
            wasMoved={wasMoved}
            originalManagerId={originalEmployee?.managerId}
            isDraggedOver={draggedEmployee?.id !== employee.id}
            onSelect={onEmployeeSelect}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onToggleDisplayMode={toggleDisplayMode}
            isSandboxMode={isSandboxMode}
          />
        </div>
        
        {/* Connection Lines and Children */}
        {hasChildren && !isCollapsed && children.length > 0 && (
          <div className="flex flex-col items-center mt-2">
            {/* Vertical line down from parent */}
            <div className="w-0.5 h-2 bg-gray-300"></div>
            
            {shouldRenderVertically ? (
              /* Vertical layout for deepest level */
              <div className="flex flex-col items-center gap-1 mt-2">
                {children.map((child, index) => (
                  <div key={child.id} className="flex flex-col items-center">
                    {/* Vertical connector line */}
                    {index === 0 && <div className="w-0.5 h-1 bg-gray-300"></div>}
                    {index > 0 && <div className="w-0.5 h-2 bg-gray-300"></div>}
                    
                    {/* Employee node */}
                    <div className="flex-shrink-0">
                      <EmployeeNode
                        employee={child}
                        level={level + 1}
                        hasChildren={false}
                        displayMode={'horizontal'}
                        isHighlighted={searchTerm && (
                          child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          child.title.toLowerCase().includes(searchTerm.toLowerCase())
                        )}
                        isCenterPerson={centerPersonId === child.id}
                        wasMoved={movedEmployeeIds.has(child.id)}
                        originalManagerId={baseEmployees.find(e => e.id === child.id)?.managerId}
                        isDraggedOver={draggedEmployee?.id !== child.id}
                        onSelect={onEmployeeSelect}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDrop={handleDrop}
                        onToggleDisplayMode={toggleDisplayMode}
                        isSandboxMode={isSandboxMode}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Horizontal layout for upper levels */
              <>
                {/* Horizontal line across children */}
                {children.length > 1 && (
                  <div className="relative">
                    <div className="h-0.5 bg-gray-300" style={{ width: `${(children.length - 1) * 200 + 80}px` }}></div>
                    {/* Vertical lines down to each child */}
                    {children.map((_, index) => (
                      <div
                        key={index}
                        className="absolute top-0 w-0.5 h-2 bg-gray-300"
                        style={{ left: `${index * 200 + 40}px` }}
                      ></div>
                    ))}
                  </div>
                )}
                
                {/* Single vertical line for single child */}
                {children.length === 1 && (
                  <div className="w-0.5 h-2 bg-gray-300"></div>
                )}
                
                {/* Children nodes */}
                <div className="flex items-start justify-center gap-4 mt-2">
                  {children.map(child => (
                    <div key={child.id} className="flex-shrink-0">
                      {renderEmployeeTree(child, level + 1)}
                    </div>
                  ))}
                </div>
              </>
            )}
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