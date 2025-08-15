import React, { useState, useEffect, useRef } from 'react';
import { X, Edit2, Save, User, Mail, Building, UserCheck, Phone, MapPin, Calendar, Briefcase, Globe, IdCard } from 'lucide-react';
import type { Employee } from '../data/mockData';
import { ColorPicker } from './ColorPicker';

interface EmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onUpdate: (employee: Employee) => void;
  isSandboxMode: boolean;
  userRole: 'admin' | 'manager' | 'assistant';
  employees: Employee[]; // To resolve manager names
  onEmployeeSelect?: (employee: Employee) => void; // To navigate to manager
}

export function EmployeeModal({
  employee,
  onClose,
  onUpdate,
  isSandboxMode,
  userRole,
  employees,
  onEmployeeSelect
}: EmployeeModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(employee);
  const modalRef = useRef<HTMLDivElement>(null);
  
  const canEdit = isSandboxMode && (userRole === 'admin' || userRole === 'manager');

  // Find manager information
  const manager = employee.managerId ? employees.find(emp => emp.id === employee.managerId) : null;

  // Click outside to close
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

  const handleSave = () => {
    onUpdate(editForm);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm(employee);
    setIsEditing(false);
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-3">
            <UserCheck className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Employee Profile</h2>
          </div>
          <div className="flex items-center space-x-2">
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-1 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-white rounded-lg transition-colors shadow-sm"
              >
                <Edit2 className="h-4 w-4" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
              title="Close (ESC)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Profile & Basic Info */}
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex flex-col items-center text-center">
                {employee.avatar ? (
                  <img
                    src={employee.avatar}
                    alt={employee.name}
                    className="w-24 h-24 rounded-full object-cover shadow-lg mb-4"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center shadow-lg mb-4">
                    <User className="h-12 w-12 text-gray-500" />
                  </div>
                )}
                
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="text-xl font-bold text-gray-900 border-b border-gray-300 focus:border-blue-500 bg-transparent text-center w-full mb-2"
                  />
                ) : (
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{employee.name}</h3>
                )}
                
                <div className="text-sm text-gray-500 mb-2">Employee ID: {employee.employeeId || employee.id}</div>
                {employee.employeeType && (
                  <div className="text-xs text-gray-500 mb-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {employee.employeeType}
                    </span>
                  </div>
                )}
                
                {/* Department Badge */}
                <span className={`inline-block px-3 py-1 text-sm rounded-full ${
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

            {/* Employment Information */}
            {(employee.employeeHireDate || employee.companyName || employee.preferredLanguage) && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Briefcase className="h-5 w-5 text-gray-600 mr-2" />
                  Employment Details
                </h4>
                
                <div className="space-y-3">
                  {employee.employeeHireDate && (
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">Hire Date</div>
                        <div className="text-sm text-gray-900">
                          {new Date(employee.employeeHireDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {employee.companyName && (
                    <div className="flex items-center space-x-3">
                      <Building className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">Company</div>
                        <div className="text-sm text-gray-900">{employee.companyName}</div>
                      </div>
                    </div>
                  )}
                  
                  {employee.preferredLanguage && (
                    <div className="flex items-center space-x-3">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">Preferred Language</div>
                        <div className="text-sm text-gray-900">{employee.preferredLanguage}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Color Picker - Only in sandbox editing mode */}
            {isEditing && isSandboxMode && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Card Color</h4>
                <ColorPicker
                  currentColor={editForm.customColor}
                  onColorChange={(color) => setEditForm({ ...editForm, customColor: color })}
                />
              </div>
            )}
          </div>

          {/* Right Column - Contact & Job Details */}
          <div className="space-y-6">
            {/* Contact Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Mail className="h-5 w-5 text-gray-600 mr-2" />
                Contact Information
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <a href={`mailto:${employee.email}`} className="text-blue-600 hover:text-blue-800">
                      {employee.email}
                    </a>
                  )}
                </div>

                {employee.phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <a href={`tel:${employee.phone}`} className="text-blue-600 hover:text-blue-800">
                        {employee.phone}
                      </a>
                    )}
                  </div>
                )}

                {employee.businessPhones && employee.businessPhones.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Phones</label>
                    <div className="space-y-1">
                      {employee.businessPhones.map((phone, index) => (
                        <a key={index} href={`tel:${phone}`} className="block text-blue-600 hover:text-blue-800 text-sm">
                          {phone}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {employee.location && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Office Location</label>
                    <div className="text-gray-900">{employee.location}</div>
                  </div>
                )}

                {employee.userPrincipalName && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <div className="text-gray-900 font-mono text-sm">{employee.userPrincipalName}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Job Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Building className="h-5 w-5 text-gray-600 mr-2" />
                Position Details
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900 font-medium">{employee.title}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900">{employee.department}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reports To</label>
                  <div className="text-gray-900">
                    {manager ? (
                      <button
                        onClick={() => onEmployeeSelect && onEmployeeSelect(manager)}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                      >
                        {manager.name}
                        <div className="text-xs text-gray-500">{manager.title}</div>
                      </button>
                    ) : employee.managerId ? (
                      <span className="text-gray-500">Manager not found (ID: {employee.managerId})</span>
                    ) : (
                      <span className="text-gray-500">No direct manager</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Address Information */}
            {(employee.streetAddress || employee.city || employee.state || employee.postalCode || employee.country) && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <MapPin className="h-5 w-5 text-gray-600 mr-2" />
                  Address Information
                </h4>
                
                <div className="space-y-2 text-sm">
                  {employee.streetAddress && (
                    <div className="text-gray-900">{employee.streetAddress}</div>
                  )}
                  <div className="text-gray-900">
                    {[employee.city, employee.state, employee.postalCode].filter(Boolean).join(', ')}
                  </div>
                  {employee.country && (
                    <div className="text-gray-900">{employee.country}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        {isEditing && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end space-x-3">
            <button
              onClick={handleCancel}
              className="px-6 py-2 text-gray-700 hover:text-gray-900 hover:bg-white border border-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            >
              <Save className="h-4 w-4" />
              <span>Save Changes</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}