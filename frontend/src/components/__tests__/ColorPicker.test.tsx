import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPicker, getCardColorStyles, getColorHex } from '../ColorPicker';

const defaultProps = {
  currentColor: undefined,
  onColorChange: jest.fn(),
  disabled: false
};

describe('ColorPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all color options', () => {
    render(<ColorPicker {...defaultProps} />);
    
    // Should have 9 color options (including default)
    const colorButtons = screen.getAllByRole('button');
    expect(colorButtons).toHaveLength(9); // 8 colors + reset button when color is selected
  });

  it('shows current color as selected', () => {
    render(<ColorPicker {...defaultProps} currentColor="blue" />);
    
    const blueButton = screen.getByTitle('Blue');
    expect(blueButton).toHaveClass('ring-2', 'ring-blue-500');
  });

  it('calls onColorChange when color is selected', () => {
    render(<ColorPicker {...defaultProps} />);
    
    const blueButton = screen.getByTitle('Blue');
    fireEvent.click(blueButton);
    
    expect(defaultProps.onColorChange).toHaveBeenCalledWith('blue');
  });

  it('shows reset button when a color is selected', () => {
    render(<ColorPicker {...defaultProps} currentColor="blue" />);
    
    const resetButton = screen.getByText('Reset');
    expect(resetButton).toBeInTheDocument();
  });

  it('calls onColorChange with undefined when reset is clicked', () => {
    render(<ColorPicker {...defaultProps} currentColor="blue" />);
    
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);
    
    expect(defaultProps.onColorChange).toHaveBeenCalledWith(undefined);
  });

  it('disables all buttons when disabled prop is true', () => {
    render(<ColorPicker {...defaultProps} disabled={true} />);
    
    const colorButtons = screen.getAllByRole('button');
    colorButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('does not show reset button when no color is selected', () => {
    render(<ColorPicker {...defaultProps} currentColor={undefined} />);
    
    expect(screen.queryByText('Reset')).not.toBeInTheDocument();
  });
});

describe('ColorPicker utility functions', () => {
  describe('getCardColorStyles', () => {
    it('returns default styles when no color provided', () => {
      const styles = getCardColorStyles();
      expect(styles).toEqual({
        background: 'bg-white',
        border: 'border-gray-200',
        hover: 'hover:border-gray-300'
      });
    });

    it('returns correct styles for blue color', () => {
      const styles = getCardColorStyles('blue');
      expect(styles).toEqual({
        background: 'bg-blue-50',
        border: 'border-blue-300',
        hover: 'hover:border-blue-400'
      });
    });

    it('returns default styles for invalid color', () => {
      const styles = getCardColorStyles('invalid-color');
      expect(styles).toEqual({
        background: 'bg-white',
        border: 'border-gray-200',
        hover: 'hover:border-gray-300'
      });
    });
  });

  describe('getColorHex', () => {
    it('returns correct hex for blue', () => {
      expect(getColorHex('blue')).toBe('#3B82F6');
    });

    it('returns correct hex for green', () => {
      expect(getColorHex('green')).toBe('#10B981');
    });

    it('returns default gray for invalid color', () => {
      expect(getColorHex('invalid-color')).toBe('#6B7280');
    });
  });
});