'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Company } from '@/types';

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  description: string;
}

export default function CreateCompany() {
  const router = useRouter();
  const { user, userProfile, setUserProfile, refreshUserProfile } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if user is not authorized
  useEffect(() => {
    if (!user || !userProfile) return;

    // Only company_admin role can create companies
    if (userProfile.role !== 'company_admin') {
      router.push('/');
      return;
    }

    // If user already has a company, redirect to admin
    if (userProfile.companyId) {
      router.push('/admin');
      return;
    }
  }, [user, userProfile, router]);

  // Email validation
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Phone validation for Malawi format
  const isValidPhone = (phone: string): boolean => {
    // Allow +265 followed by 9 digits, with optional spaces or dashes
    const phoneRegex = /^\+265\s?[0-9]{9}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  };

  // Form validation
  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Company name is required';
    }

    if (formData.name.trim().length < 2) {
      return 'Company name must be at least 2 characters long';
    }

    if (!formData.email.trim()) {
      return 'Company email is required';
    }

    if (!isValidEmail(formData.email.trim())) {
      return 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      return 'Company phone number is required';
    }

    if (!isValidPhone(formData.phone.trim())) {
      return 'Phone number must be in +265 format (e.g., +265123456789)';
    }

    if (!formData.address.trim()) {
      return 'Company address is required';
    }

    if (formData.address.trim().length < 5) {
      return 'Please enter a more detailed address';
    }

    return null;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    // Clear error when user starts typing
    if (error) setError('');
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      // Check authentication
      if (!user || !userProfile) {
        throw new Error('You must be logged in to create a company');
      }

      // Check authorization
      if (userProfile.role !== 'company_admin') {
        throw new Error('Only company administrators can create companies');
      }

      // Check if user already has a company
      if (userProfile.companyId) {
        throw new Error('You already have a company associated with your account');
      }

      // Validate form
      const validationError = validateForm();
      if (validationError) {
        throw new Error(validationError);
      }

      // Clean phone number (remove spaces/dashes)
      const cleanPhone = formData.phone.replace(/[\s-]/g, '');

      // Create company object
      const company: Company = {
        id: user.uid,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: cleanPhone,
        address: formData.address.trim(),
        description: formData.description.trim(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('Creating company in Firestore:', company);

      // Save company to Firestore
      await setDoc(doc(db, 'companies', user.uid), company);

      console.log('Updating user profile with companyId:', user.uid);

      // Update user profile with companyId
      await setDoc(
        doc(db, 'users', user.uid), 
        { 
          companyId: user.uid,
          updatedAt: new Date()
        }, 
        { merge: true }
      );

      // Refresh user profile to get updated data
      await refreshUserProfile();

      console.log('Company created successfully, redirecting to /admin');
      router.push('/admin');

    } catch (error: any) {
      console.error('Create company error:', error);
      setError(error.message || 'Failed to create company. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading if auth is still being determined
  if (!user || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show unauthorized message if not company admin
  if (userProfile.role !== 'company_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">Only company administrators can create companies.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-2xl">B</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create Your Bus Company
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Set up your company to start managing buses and routes
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Company Name <span className="text-red-500">*</span>REQUIRED
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="organization"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your company name"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Company Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="company@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Company Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="+265123456789"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Must include country code +265 followed by 9 digits
              </p>
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                Company Address <span className="text-red-500">*</span>
              </label>
              <input
                id="address"
                name="address"
                type="text"
                autoComplete="street-address"
                required
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your company address"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description <span className="text-gray-500">(Optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                rows={4}
                placeholder="Brief description of your bus company..."
                disabled={loading}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating company...
                  </div>
                ) : (
                  'Create Company'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}