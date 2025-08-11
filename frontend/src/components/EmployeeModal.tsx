import React, { useState } from 'react';
import { X, Edit2, Save, User, Mail, Phone, Building, MapPin } from 'lucide-react';
import type { Employee } from '../data/mockData';

interface EmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onUpdate: (employee: Employee) => void;
  isSandboxMode: boolean;
  userRole: 'admin' | 'manager' | 'assistant';
}

export function EmployeeModal({
  employee,
  onClose,
  onUpdate,
  isSandboxMode,
  userRole
}: EmployeeModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(employee);
  
  const canEdit = isSandboxMode && (userRole === 'admin' || userRole === 'manager');

  const handleSave = () => {
    onUpdate(editForm);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm(employee);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Employee Details</h2>
          <div className="flex items-center space-x-2">
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-1 px-3 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
              >
                <Edit2 className="h-4 w-4" />
                <span>Edit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            {employee.avatar ? (
              <img
                src={employee.avatar}
                alt={employee.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-500" />
              </div>
            )}
            
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="text-xl font-bold text-gray-900 border-b border-gray-300 focus:border-blue-500 bg-transparent w-full"
                />
              ) : (
                <h3 className="text-xl font-bold text-gray-900">{employee.name}</h3>
              )}
              
              <div className="text-sm text-gray-500 mt-1">ID: {employee.id}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Building className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="text-gray-900">{employee.title}</div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Building className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
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
            </div>

            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="text-gray-900">{employee.email}</div>
                )}
              </div>
            </div>

            {employee.phone && (
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900">{employee.phone}</div>
                  )}
                </div>
              </div>
            )}

            {employee.location && (
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <div className="text-gray-900">{employee.location}</div>
                </div>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}