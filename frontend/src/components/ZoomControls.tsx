import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  return (
    <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-md border border-gray-200 p-2 space-y-2">
      <button
        onClick={onZoomIn}
        disabled={zoom >= 2}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Zoom in"
      >
        <ZoomIn className="h-4 w-4 text-gray-600" />
      </button>
      
      <div className="text-xs text-gray-500 text-center px-1">
        {Math.round(zoom * 100)}%
      </div>
      
      <button
        onClick={onZoomOut}
        disabled={zoom <= 0.3}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-4 w-4 text-gray-600" />
      </button>
      
      <div className="border-t border-gray-200 pt-2">
        <button
          onClick={onReset}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
          aria-label="Reset zoom and pan"
        >
          <RotateCcw className="h-4 w-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}