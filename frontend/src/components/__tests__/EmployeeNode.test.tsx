/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmployeeNode } from '../EmployeeNode';
import type { Employee } from '../../data/mockData';

const mockEmployee: Employee = {
  id: '1',
  name: 'John Doe',
  title: 'Software Engineer',
  department: 'Engineering',
  email: 'john.doe@company.com',
  phone: '+1 (555) 123-4567',
  managerId: '2'
};

const defaultProps = {
  employee: mockEmployee,
  level: 0,
  hasChildren: false,
  displayMode: 'horizontal' as const,
  isDraggedOver: false,
  onSelect: jest.fn(),
  onDragStart: jest.fn(),
  onDragEnd: jest.fn(),
  onDrop: jest.fn(),
  onToggleDisplayMode: jest.fn(),
  isSandboxMode: false
};

describe('EmployeeNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders employee information correctly', () => {
    render(<EmployeeNode {...defaultProps} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('john.doe@company.com')).toBeInTheDocument();
    expect(screen.getByText('+1 (555) 123-4567')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    render(<EmployeeNode {...defaultProps} />);
    
    fireEvent.click(screen.getByText('John Doe'));
    
    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockEmployee);
  });

  it('shows toggle button when hasChildren is true', () => {
    render(<EmployeeNode {...defaultProps} hasChildren={true} />);
    
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('title', 'Click to change layout (current: horizontal)');
  });

  it('does not show toggle button when hasChildren is false', () => {
    render(<EmployeeNode {...defaultProps} hasChildren={false} />);
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onToggleDisplayMode when toggle button is clicked', () => {
    render(<EmployeeNode {...defaultProps} hasChildren={true} />);
    
    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);
    
    expect(defaultProps.onToggleDisplayMode).toHaveBeenCalledWith('1');
  });

  it('shows highlighted styling when isHighlighted is true', () => {
    render(<EmployeeNode {...defaultProps} isHighlighted={true} />);
    
    // Find the actual card div (with specific structure)
    const nameElement = screen.getByText('John Doe');
    const card = nameElement.closest('[class*="rounded-lg"]');
    expect(card).toHaveClass('ring-2', 'ring-blue-500');
  });

  it('shows center person styling when isCenterPerson is true', () => {
    render(<EmployeeNode {...defaultProps} isCenterPerson={true} />);
    
    const nameElement = screen.getByText('John Doe');
    const card = nameElement.closest('[class*="rounded-lg"]');
    expect(card).toHaveClass('ring-2', 'ring-purple-500');
  });

  it('shows moved indicator when wasMoved is true in sandbox mode', () => {
    render(<EmployeeNode {...defaultProps} wasMoved={true} isSandboxMode={true} />);
    
    const movedIndicator = screen.getByTitle('Employee has been reassigned');
    expect(movedIndicator).toBeInTheDocument();
  });

  it('does not show moved indicator when not in sandbox mode', () => {
    render(<EmployeeNode {...defaultProps} wasMoved={true} isSandboxMode={false} />);
    
    expect(screen.queryByTitle('Employee has been reassigned')).not.toBeInTheDocument();
  });

  it('applies custom color when specified', () => {
    const employeeWithColor = { ...mockEmployee, customColor: 'blue' };
    render(<EmployeeNode {...defaultProps} employee={employeeWithColor} />);
    
    const nameElement = screen.getByText('John Doe');
    const card = nameElement.closest('[class*="rounded-lg"]');
    expect(card).toHaveClass('bg-blue-50', 'border-blue-300');
  });

  it('handles drag events in sandbox mode', () => {
    render(<EmployeeNode {...defaultProps} isSandboxMode={true} />);
    
    const nameElement = screen.getByText('John Doe');
    const card = nameElement.closest('[class*="rounded-lg"]');
    expect(card).toHaveAttribute('draggable', 'true');
    
    fireEvent.dragStart(card!);
    expect(defaultProps.onDragStart).toHaveBeenCalledWith(mockEmployee);
  });

  it('does not allow dragging when not in sandbox mode', () => {
    render(<EmployeeNode {...defaultProps} isSandboxMode={false} />);
    
    const nameElement = screen.getByText('John Doe');
    const card = nameElement.closest('[class*="rounded-lg"]');
    expect(card).toHaveAttribute('draggable', 'false');
  });
});