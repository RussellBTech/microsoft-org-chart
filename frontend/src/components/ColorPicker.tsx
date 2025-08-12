import React from 'react';
import { Palette, RotateCcw } from 'lucide-react';

interface ColorPickerProps {
  currentColor?: string;
  onColorChange: (color: string | undefined) => void;
  disabled?: boolean;
}

// Predefined color palette for org chart cards
const COLOR_PALETTE = [
  { name: 'Default', value: undefined, bg: 'bg-white', border: 'border-gray-200' },
  { name: 'Blue', value: 'blue', bg: 'bg-blue-50', border: 'border-blue-300' },
  { name: 'Green', value: 'green', bg: 'bg-green-50', border: 'border-green-300' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-50', border: 'border-purple-300' },
  { name: 'Orange', value: 'orange', bg: 'bg-orange-50', border: 'border-orange-300' },
  { name: 'Pink', value: 'pink', bg: 'bg-pink-50', border: 'border-pink-300' },
  { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-300' },
  { name: 'Indigo', value: 'indigo', bg: 'bg-indigo-50', border: 'border-indigo-300' },
  { name: 'Red', value: 'red', bg: 'bg-red-50', border: 'border-red-300' },
];

export function ColorPicker({ currentColor, onColorChange, disabled = false }: ColorPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">Card Color</span>
        {currentColor && (
          <button
            onClick={() => onColorChange(undefined)}
            disabled={disabled}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 disabled:opacity-50"
            title="Reset to default color"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-5 gap-2">
        {COLOR_PALETTE.map((color) => (
          <button
            key={color.value || 'default'}
            onClick={() => onColorChange(color.value)}
            disabled={disabled}
            className={`
              relative w-12 h-8 rounded-md border-2 transition-all
              ${color.bg} ${color.border}
              ${currentColor === color.value ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'}
            `}
            title={color.name}
          >
            {currentColor === color.value && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              </div>
            )}
            {color.value === undefined && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                Default
              </div>
            )}
          </button>
        ))}
      </div>
      
      <p className="text-xs text-gray-500">
        Choose a color to highlight this employee's card in the org chart
      </p>
    </div>
  );
}

// Helper function to get hex color for indicators
export function getColorHex(customColor: string): string {
  const colorMap = {
    blue: '#3B82F6',
    green: '#10B981',
    purple: '#8B5CF6',
    orange: '#F97316',
    pink: '#EC4899',
    yellow: '#F59E0B',
    indigo: '#6366F1',
    red: '#EF4444',
  };
  
  return colorMap[customColor as keyof typeof colorMap] || '#6B7280';
}

// Helper function to get card styling based on color
export function getCardColorStyles(customColor?: string) {
  if (!customColor) {
    return {
      background: 'bg-white',
      border: 'border-gray-200',
      hover: 'hover:border-gray-300'
    };
  }

  const colorMap = {
    blue: { background: 'bg-blue-50', border: 'border-blue-300', hover: 'hover:border-blue-400' },
    green: { background: 'bg-green-50', border: 'border-green-300', hover: 'hover:border-green-400' },
    purple: { background: 'bg-purple-50', border: 'border-purple-300', hover: 'hover:border-purple-400' },
    orange: { background: 'bg-orange-50', border: 'border-orange-300', hover: 'hover:border-orange-400' },
    pink: { background: 'bg-pink-50', border: 'border-pink-300', hover: 'hover:border-pink-400' },
    yellow: { background: 'bg-yellow-50', border: 'border-yellow-300', hover: 'hover:border-yellow-400' },
    indigo: { background: 'bg-indigo-50', border: 'border-indigo-300', hover: 'hover:border-indigo-400' },
    red: { background: 'bg-red-50', border: 'border-red-300', hover: 'hover:border-red-400' },
  };

  return colorMap[customColor as keyof typeof colorMap] || {
    background: 'bg-white',
    border: 'border-gray-200', 
    hover: 'hover:border-gray-300'
  };
}