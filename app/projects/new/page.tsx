'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewProjectPage() {
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    description: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    domain: '',
    description: ''
  });
  const router = useRouter();

  const validateForm = () => {
    const errors = {
      name: '',
      domain: '',
      description: ''
    };
    let isValid = true;

    // Name validation
    if (formData.name.length > 100) {
      errors.name = 'Project name cannot exceed 100 characters';
      isValid = false;
    }

    // Domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(formData.domain)) {
      errors.domain = 'Please enter a valid domain (e.g., example.com)';
      isValid = false;
    }

    // Description validation
    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description cannot exceed 500 characters';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          domain: formData.domain.toLowerCase()
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const project = await response.json();
      router.push(`/projects/${project._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    setFieldErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Create New Project</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Project Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              fieldErrors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="My Website Project"
          />
          {fieldErrors.name && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Maximum 100 characters
          </p>
        </div>

        <div className="mb-4">
          <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
            Domain Name *
          </label>
          <input
            type="text"
            id="domain"
            name="domain"
            required
            value={formData.domain}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              fieldErrors.domain ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="example.com"
          />
          {fieldErrors.domain && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.domain}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Enter domain without http:// or https:// (e.g., example.com)
          </p>
        </div>

        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              fieldErrors.description ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={4}
            placeholder="Project description (optional)"
          />
          {fieldErrors.description && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.description}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Maximum 500 characters
          </p>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}