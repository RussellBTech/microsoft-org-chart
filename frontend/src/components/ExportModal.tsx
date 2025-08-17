import React, { useState, useRef, useEffect } from 'react';
import { X, Download, FileText, Code, Camera } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Employee, Scenario } from '../data/mockData';

interface ExportModalProps {
  employees: Employee[];
  scenario: Scenario | null;
  onClose: () => void;
  orgChartRef?: React.RefObject<HTMLElement>;
}

export function ExportModal({ employees, scenario, onClose, orgChartRef }: ExportModalProps) {
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>('json');
  const [includeImages, setIncludeImages] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle outside click and escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  const generatePDF = async (fileName: string) => {
    if (!orgChartRef?.current) {
      alert('Org chart not available for PDF export');
      return;
    }

    setIsGeneratingPdf(true);
    
    try {
      // Find the org chart container specifically to avoid capturing sidebar
      const orgChartContainer = orgChartRef.current.querySelector('.org-chart-container') as HTMLElement;
      const targetElement = orgChartContainer || orgChartRef.current;
      
      // Temporarily reset any transforms and get full content size
      const originalTransform = targetElement.style.transform;
      const originalOverflow = targetElement.style.overflow;
      
      // Reset transform and overflow to capture full content
      targetElement.style.transform = 'none';
      targetElement.style.overflow = 'visible';
      
      // Configure html2canvas for better quality and full content capture
      const canvas = await html2canvas(targetElement, {
        scale: 1, // Use scale 1 to avoid issues with transforms
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: targetElement.scrollWidth,
        height: targetElement.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        foreignObjectRendering: true,
        removeContainer: false
      });
      
      // Restore original styles
      targetElement.style.transform = originalTransform;
      targetElement.style.overflow = originalOverflow;

      // Calculate dimensions for PDF
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Use standard page sizes and scale content to fit
      const isLandscape = imgWidth > imgHeight;
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      // Get PDF page dimensions
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate scaling to fit content on page with some margin
      const margin = 20;
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2);
      
      const scaleX = availableWidth / imgWidth;
      const scaleY = availableHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY); // Use smaller scale to ensure it fits
      
      // Calculate centered position
      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;
      const x = (pageWidth - scaledWidth) / 2;
      const y = (pageHeight - scaledHeight) / 2;

      // Add the org chart image scaled to fit
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);

      // Save the PDF
      pdf.save(`${fileName}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  
  const exportData = async () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = scenario 
      ? `org-chart-${scenario.name}-${timestamp}`
      : `org-chart-${timestamp}`;

    if (exportFormat === 'json') {
      const exportObject = {
        metadata: {
          exportDate: new Date().toISOString(),
          scenario: scenario?.name || 'Live Data',
          totalEmployees: employees.length,
          includeImages
        },
        employees: employees.map(emp => ({
          ...emp,
          avatar: includeImages ? emp.avatar : undefined
        }))
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], {
        type: 'application/json'
      });
      downloadFile(blob, `${fileName}.json`);
    } else if (exportFormat === 'csv') {
      const headers = ['ID', 'Name', 'Title', 'Department', 'Email', 'Phone', 'Manager ID', 'Location'];
      const csvContent = [
        headers.join(','),
        ...employees.map(emp => [
          emp.id,
          `"${emp.name}"`,
          `"${emp.title}"`,
          `"${emp.department}"`,
          emp.email,
          emp.phone || '',
          emp.managerId || '',
          emp.location || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      downloadFile(blob, `${fileName}.csv`);
    } else if (exportFormat === 'pdf') {
      await generatePDF(fileName);
    }
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Export Org Chart</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Export Format
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={(e) => setExportFormat(e.target.value as 'json')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <Code className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">JSON</div>
                  <div className="text-sm text-gray-500">Machine-readable format with full data</div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={(e) => setExportFormat(e.target.value as 'csv')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <FileText className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">CSV</div>
                  <div className="text-sm text-gray-500">Spreadsheet-compatible format</div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  value="pdf"
                  checked={exportFormat === 'pdf'}
                  onChange={(e) => setExportFormat(e.target.value as 'pdf')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <Camera className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">PDF Chart</div>
                  <div className="text-sm text-gray-500">High-resolution visual org chart</div>
                </div>
              </label>
            </div>
          </div>

          {exportFormat === 'json' && (
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Include profile images</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                May increase file size significantly
              </p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-700">
              <div className="flex justify-between mb-2">
                <span>Data Source:</span>
                <span className="font-medium">
                  {scenario ? `Scenario: ${scenario.name}` : 'Live Data'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Employees:</span>
                <span className="font-medium">{employees.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={exportData}
            disabled={isGeneratingPdf}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            {isGeneratingPdf ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Export</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}