import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickColorPicker } from '../QuickColorPicker';

const defaultProps = {
  currentColor: undefined,
  onColorChange: jest.fn(),
  disabled: false
};

describe('QuickColorPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the trigger button', () => {
    render(<QuickColorPicker {...defaultProps} />);
    
    const button = screen.getByTitle('Quick color change');
    expect(button).toBeInTheDocument();
  });

  it('does not render when disabled', () => {
    render(<QuickColorPicker {...defaultProps} disabled={true} />);
    
    expect(screen.queryByTitle('Quick color change')).not.toBeInTheDocument();
  });

  it('opens color grid when clicked', () => {
    render(<QuickColorPicker {...defaultProps} />);
    
    const button = screen.getByTitle('Quick color change');
    fireEvent.click(button);
    
    // Should show color options
    expect(screen.getByTitle('Blue')).toBeInTheDocument();
    expect(screen.getByTitle('Green')).toBeInTheDocument();
    expect(screen.getByTitle('Default')).toBeInTheDocument();
  });

  it('calls onColorChange when color is selected', () => {
    render(<QuickColorPicker {...defaultProps} />);
    
    const button = screen.getByTitle('Quick color change');
    fireEvent.click(button);
    
    const blueButton = screen.getByTitle('Blue');
    fireEvent.click(blueButton);
    
    expect(defaultProps.onColorChange).toHaveBeenCalledWith('blue');
  });

  it('closes dropdown after color selection', () => {
    render(<QuickColorPicker {...defaultProps} />);
    
    const button = screen.getByTitle('Quick color change');
    fireEvent.click(button);
    
    const blueButton = screen.getByTitle('Blue');
    fireEvent.click(blueButton);
    
    // Should close - blue button should no longer be visible
    expect(screen.queryByTitle('Blue')).not.toBeInTheDocument();
  });

  it('stops propagation on button click', () => {
    const mockParentClick = jest.fn();
    
    const ParentComponent = () => (
      <div onClick={mockParentClick}>
        <QuickColorPicker {...defaultProps} />
      </div>
    );
    
    render(<ParentComponent />);
    
    const button = screen.getByTitle('Quick color change');
    fireEvent.click(button);
    
    // Parent click should not be triggered
    expect(mockParentClick).not.toHaveBeenCalled();
  });
});