import React, { useState, useRef, useCallback, useEffect } from 'react';
import { EmployeeNode } from './EmployeeNode';
import { ZoomControls } from './ZoomControls';
import type { Employee } from '../data/mockData';

interface OrgChartProps {
  employees: Employee[];
  isSandboxMode: boolean;
  centerPersonId?: string;
  movedEmployeeIds: Set<string>;
  baseEmployees: Employee[];
  onEmployeeSelect: (employee: Employee) => void;
  onEmployeeReassign: (employeeId: string, newManagerId: string | null) => void;
  onEmployeeColorChange?: (employeeId: string, color: string | undefined) => void;
}

type DisplayMode = 'horizontal' | 'vertical' | 'collapsed';

interface NodePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
}

// Hook for measuring node positions and calculating dynamic line positions
function useMeasureNodes() {
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerNode = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      nodeRefs.current.set(id, element);
    } else {
      nodeRefs.current.delete(id);
    }
  }, []);

  const measureNodes = useCallback(() => {
    const newPositions = new Map<string, NodePosition>();
    
    nodeRefs.current.forEach((element, id) => {
      const rect = element.getBoundingClientRect();
      const containerRect = element.closest('.org-chart-container')?.getBoundingClientRect();
      
      if (containerRect) {
        const position: NodePosition = {
          id,
          x: rect.left - containerRect.left,
          y: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
          centerX: (rect.left - containerRect.left) + rect.width / 2
        };
        newPositions.set(id, position);
      }
    });
    
    setNodePositions(newPositions);
  }, []);

  return {
    nodePositions,
    registerNode,
    measureNodes
  };
}

// Component for dynamic connection lines that adapt to actual node positions
function DynamicConnectionLines({ 
  parentId, 
  childIds, 
  nodePositions 
}: { 
  parentId: string; 
  childIds: string[]; 
  nodePositions: Map<string, NodePosition>; 
}) {
  if (childIds.length === 0) return null;

  const parentPos = nodePositions.get(parentId);
  const childPositions = childIds.map(id => nodePositions.get(id)).filter(Boolean) as NodePosition[];

  if (!parentPos || childPositions.length === 0) {
    return null;
  }

  if (childIds.length === 1) {
    // Single child - simple vertical line
    const childPos = childPositions[0];
    return (
      <>
        <div 
          className="absolute w-0.5 bg-gray-300 pointer-events-none"
          style={{
            left: parentPos.centerX - 1,
            top: parentPos.y + parentPos.height,
            height: childPos.y - (parentPos.y + parentPos.height)
          }}
        />
      </>
    );
  }

  // Multiple children - calculate dynamic horizontal span
  const leftmostChild = childPositions.reduce((min, pos) => 
    pos.centerX < min.centerX ? pos : min
  );
  const rightmostChild = childPositions.reduce((max, pos) => 
    pos.centerX > max.centerX ? pos : max
  );

  const horizontalLineY = parentPos.y + parentPos.height + 6; // 6px gap to align with mt-3
  const horizontalLineLeft = leftmostChild.centerX;
  const horizontalLineWidth = rightmostChild.centerX - leftmostChild.centerX;

  return (
    <>
      {/* Vertical line down from parent */}
      <div 
        className="absolute w-0.5 h-6 bg-gray-300 pointer-events-none"
        style={{
          left: parentPos.centerX - 1,
          top: parentPos.y + parentPos.height
        }}
      />
      
      {/* Horizontal spanning line */}
      <div 
        className="absolute h-0.5 bg-gray-300 pointer-events-none"
        style={{
          left: horizontalLineLeft,
          top: horizontalLineY,
          width: Math.max(horizontalLineWidth, 4) // Minimum 4px width
        }}
      />
      
      {/* Vertical lines down to each child */}
      {childPositions.map((childPos) => (
        <div
          key={childPos.id}
          className="absolute w-0.5 bg-gray-300 pointer-events-none"
          style={{
            left: childPos.centerX - 1,
            top: horizontalLineY,
            height: childPos.y - horizontalLineY
          }}
        />
      ))}
    </>
  );
}

export function OrgChart({
  employees,
  isSandboxMode,
  centerPersonId,
  movedEmployeeIds,
  baseEmployees,
  onEmployeeSelect,
  onEmployeeReassign,
  onEmployeeColorChange
}: OrgChartProps) {
  console.log('🔍 OrgChart render:', {
    employeeCount: employees.length,
    centerPersonId,
    firstFewEmployees: employees.slice(0, 3).map(e => ({ id: e.id, name: e.name }))
  });
  const [zoom, setZoom] = useState(1);
  const [draggedEmployee, setDraggedEmployee] = useState<Employee | null>(null);
  const [nodeDisplayModes, setNodeDisplayModes] = useState<Map<string, DisplayMode>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use the measurement hook for dynamic positioning
  const { nodePositions, registerNode, measureNodes } = useMeasureNodes();

  // Trigger measurement after layout changes
  useEffect(() => {
    const timeoutId = setTimeout(measureNodes, 100);
    return () => clearTimeout(timeoutId);
  }, [measureNodes, employees, nodeDisplayModes]);

  // Additional trigger for sandbox mode changes (employee reassignments)
  useEffect(() => {
    if (isSandboxMode) {
      const timeoutId = setTimeout(measureNodes, 150); // Slightly longer delay for DOM updates
      return () => clearTimeout(timeoutId);
    }
  }, [measureNodes, movedEmployeeIds, isSandboxMode]);

  // Handle window resize events that could affect node positioning
  useEffect(() => {
    const handleResize = () => {
      setTimeout(measureNodes, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureNodes]);

  // Trigger remeasurement after data reload (like when exiting sandbox mode)
  useEffect(() => {
    setTimeout(measureNodes, 200); // Longer delay for data reload
  }, [measureNodes, employees]);

  // Build hierarchy with improved data integrity for HR use
  const buildHierarchy = useCallback((employees: Employee[]) => {
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
    const childrenMap = new Map<string, Employee[]>();
    const teamSizeMap = new Map<string, number>(); // Track total team size for each manager
    const rootEmployees: Employee[] = [];
    
    // Track all employees to ensure none are lost
    const processedEmployees = new Set<string>();

    // First, build the children map
    employees.forEach(emp => {
      if (emp.managerId) {
        if (employeeMap.has(emp.managerId)) {
          // Valid manager relationship
          const children = childrenMap.get(emp.managerId) || [];
          children.push(emp);
          childrenMap.set(emp.managerId, children);
        }
        // Skip employees with invalid manager IDs silently
      }
    });

    // Calculate team sizes (recursive count of all reports)
    const calculateTeamSize = (managerId: string): number => {
      if (teamSizeMap.has(managerId)) {
        return teamSizeMap.get(managerId)!;
      }
      
      const directReports = childrenMap.get(managerId) || [];
      let totalSize = directReports.length;
      
      directReports.forEach(report => {
        totalSize += calculateTeamSize(report.id);
      });
      
      teamSizeMap.set(managerId, totalSize);
      return totalSize;
    };

    // Calculate team sizes for all managers
    childrenMap.forEach((_, managerId) => {
      calculateTeamSize(managerId);
    });

    // Find legitimate root employees (CEOs, top executives)
    employees.forEach(emp => {
      if (!emp.managerId) {
        rootEmployees.push(emp);
        processedEmployees.add(emp.id);
      }
    });

    // Detect circular references
    const detectCircularReferences = (empId: string, visited: Set<string> = new Set()): boolean => {
      if (visited.has(empId)) {
        return true; // Circular reference detected
      }
      
      const employee = employeeMap.get(empId);
      if (!employee || !employee.managerId) {
        return false;
      }
      
      visited.add(empId);
      return detectCircularReferences(employee.managerId, visited);
    };

    // Check for circular references (silently skip them)
    employees.forEach(emp => {
      if (emp.managerId && detectCircularReferences(emp.id)) {
        // Skip circular references silently
      }
    });

    // If no legitimate roots found, find potential roots (people who manage others but aren't managed)
    if (rootEmployees.length === 0 && employees.length > 0) {
      const managedEmployees = new Set<string>();
      employees.forEach(emp => {
        if (emp.managerId && employeeMap.has(emp.managerId)) {
          managedEmployees.add(emp.id);
        }
      });
      
      employees.forEach(emp => {
        if (!managedEmployees.has(emp.id) && childrenMap.has(emp.id)) {
          rootEmployees.push(emp);
          processedEmployees.add(emp.id);
        }
      });
      
      // No warning needed - just proceed with inferred structure
    }

    // Ensure ALL employees are accounted for - more careful tracking
    const getProcessedInHierarchy = (empId: string, visited: Set<string> = new Set()): void => {
      if (visited.has(empId)) {
        // Detect potential circular references
        // Skip circular references silently
        return;
      }
      
      visited.add(empId);
      processedEmployees.add(empId);
      
      const children = childrenMap.get(empId) || [];
      children.forEach(child => {
        getProcessedInHierarchy(child.id, new Set(visited)); // Create new visited set for each branch
      });
    };

    // Mark all reachable employees as processed
    rootEmployees.forEach(root => {
      getProcessedInHierarchy(root.id);
    });

    // Handle any unprocessed employees - add them back to hierarchy if possible
    const unprocessedEmployees = employees.filter(emp => !processedEmployees.has(emp.id));
    
    unprocessedEmployees.forEach(emp => {
      if (emp.managerId && employeeMap.has(emp.managerId)) {
        // This employee has a valid manager, add them to hierarchy
        const manager = employeeMap.get(emp.managerId)!;
        processedEmployees.add(emp.id);
        
        // Add to children map
        const managerChildren = childrenMap.get(manager.id) || [];
        if (!managerChildren.find(c => c.id === emp.id)) {
          managerChildren.push(emp);
          childrenMap.set(manager.id, managerChildren);
        }
        
        // If manager has no manager and isn't a root, add them
        if (!manager.managerId && !rootEmployees.find(r => r.id === manager.id)) {
          rootEmployees.push(manager);
          processedEmployees.add(manager.id);
        }
      }
      // Silently skip employees without valid managers
    });

    // Final safety check - if still no roots, use first employee as fallback
    if (rootEmployees.length === 0 && employees.length > 0) {
      rootEmployees.push(employees[0]);
    }


    return { 
      rootEmployees, 
      childrenMap, 
      employeeMap, 
      teamSizeMap
    };
  }, []);

  const { 
    rootEmployees: defaultRoots, 
    childrenMap, 
    employeeMap,
    teamSizeMap
  } = buildHierarchy(employees);
  
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
    // Trigger line recalculation after drag ends
    setTimeout(measureNodes, 200);
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
    
    // Trigger line recalculation after organizational change
    setTimeout(measureNodes, 250);
  };

  const toggleDisplayMode = (employeeId: string) => {
    setNodeDisplayModes(prev => {
      const newMap = new Map(prev);
      
      // Get current mode, considering the default based on level and children
      const employee = employeeMap.get(employeeId);
      if (!employee) return newMap;
      
      const children = childrenMap.get(employeeId) || [];
      const hasChildren = children.length > 0;
      if (!hasChildren) return newMap; // No point toggling if no children
      
      // Find the employee's level by traversing up the hierarchy
      let level = 0;
      let current = employee;
      while (current.managerId && employeeMap.has(current.managerId)) {
        level++;
        current = employeeMap.get(current.managerId)!;
      }
      
      const isDeepestLevel = level >= 2;
      const defaultMode: DisplayMode = (isDeepestLevel && hasChildren) ? 'vertical' : 'horizontal';
      
      const currentMode = newMap.get(employeeId) || defaultMode;
      
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
      
      // Trigger line recalculation after display mode change
      setTimeout(measureNodes, 100);
      
      return newMap;
    });
  };

  const renderEmployeeTree = (employee: Employee, level: number = 0): JSX.Element => {
    const children = childrenMap.get(employee.id) || [];
    const hasChildren = children.length > 0;
    
    // Get team metrics
    const directReportsCount = children.length;
    const totalTeamSize = teamSizeMap.get(employee.id) || 0;
    
    // Determine default display mode based on level
    const isDeepestLevel = level >= 2;
    const defaultMode: DisplayMode = (isDeepestLevel && hasChildren) ? 'vertical' : 'horizontal';
    
    // Get the actual display mode (use default if not set)
    const displayMode = nodeDisplayModes.get(employee.id) || defaultMode;
    const isCollapsed = displayMode === 'collapsed';
    
    const isCenterPerson = centerPersonId === employee.id;
    
    // Check if employee was moved in sandbox
    const wasMoved = movedEmployeeIds.has(employee.id);
    const originalEmployee = baseEmployees.find(e => e.id === employee.id);
    
    // Use the display mode to determine rendering
    const shouldRenderVertically = displayMode === 'vertical';

    return (
      <div key={employee.id} className="flex flex-col items-center">
        {/* Employee Node */}
        <div 
          className="relative"
          ref={(el) => registerNode(employee.id, el)}
        >
          <EmployeeNode
            employee={employee}
            level={level}
            hasChildren={hasChildren}
            displayMode={displayMode}
            isHighlighted={false}
            isCenterPerson={isCenterPerson}
            wasMoved={wasMoved}
            originalManagerId={originalEmployee?.managerId}
            isDraggedOver={draggedEmployee?.id !== employee.id}
            directReportsCount={directReportsCount}
            totalTeamSize={totalTeamSize}
            onSelect={onEmployeeSelect}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onToggleDisplayMode={toggleDisplayMode}
            onColorChange={onEmployeeColorChange}
            isSandboxMode={isSandboxMode}
          />
        </div>
        
        {/* Children and Dynamic Connection Lines */}
        {hasChildren && !isCollapsed && children.length > 0 && (
          <div className="flex flex-col items-center mt-3">
            {shouldRenderVertically ? (
              /* Vertical layout for deepest level */
              <div className="flex flex-col items-center gap-4">
                {children.map((child) => (
                  <div 
                    key={child.id} 
                    className="flex-shrink-0"
                    ref={(el) => registerNode(child.id, el)}
                  >
                    <EmployeeNode
                      employee={child}
                      level={level + 1}
                      hasChildren={false}
                      displayMode={'horizontal'}
                      isHighlighted={false}
                      isCenterPerson={centerPersonId === child.id}
                      wasMoved={movedEmployeeIds.has(child.id)}
                      originalManagerId={baseEmployees.find(e => e.id === child.id)?.managerId}
                      isDraggedOver={draggedEmployee?.id !== child.id}
                      directReportsCount={childrenMap.get(child.id)?.length || 0}
                      totalTeamSize={teamSizeMap.get(child.id) || 0}
                      onSelect={onEmployeeSelect}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDrop={handleDrop}
                      onToggleDisplayMode={toggleDisplayMode}
                      onColorChange={onEmployeeColorChange}
                      isSandboxMode={isSandboxMode}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* Horizontal layout for upper levels */
              <div className="flex items-start justify-center gap-6">
                {children.map(child => (
                  <div key={child.id} className="flex-shrink-0">
                    {renderEmployeeTree(child, level + 1)}
                  </div>
                ))}
              </div>
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
        }}
      />
      
      <div
        ref={containerRef}
        className="h-full overflow-auto p-6 org-chart-container"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left'
        }}
      >
        {/* Dynamic Connection Lines Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from(childrenMap.entries()).map(([parentId, children]) => {
            if (children.length === 0) return null;
            const displayMode = nodeDisplayModes.get(parentId);
            if (displayMode === 'collapsed') return null;
            
            return (
              <DynamicConnectionLines
                key={parentId}
                parentId={parentId}
                childIds={children.map(c => c.id)}
                nodePositions={nodePositions}
              />
            );
          })}
        </div>
        
        <div className="flex flex-col items-center min-w-max relative">

          {/* Main Organization Hierarchy */}
          {rootEmployees.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <p>No employees to display</p>
            </div>
          ) : rootEmployees.length > 1 ? (
            <div className="flex flex-wrap gap-8 justify-center">
              {rootEmployees.map(employee => (
                <div key={employee.id} className="flex flex-col items-center">
                  <div className="text-sm text-gray-500 mb-2">
                    {rootEmployees.length > 1 ? `Organization Tree (${employee.department || 'Unknown Dept'})` : 'Organization Tree'}
                  </div>
                  {renderEmployeeTree(employee)}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="text-lg font-medium text-gray-700 mb-3">Organization Hierarchy</div>
              {rootEmployees.map(employee => (
                <div key={employee.id}>{renderEmployeeTree(employee)}</div>
              ))}
            </div>
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