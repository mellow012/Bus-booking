'use client';

import React, { useState } from 'react';
import { PassengerDetail } from '@/types';

interface PassengerFormProps {
  passengerDetails: PassengerDetail[];
  onSubmit: (details: PassengerDetail[]) => void;
  onBack: () => void;
}

export default function PassengerForm({ passengerDetails, onSubmit, onBack }: PassengerFormProps) {
  const [details, setDetails] = useState<PassengerDetail[]>(passengerDetails);
  const [error, setError] = useState('');

  const handleChange = (index: number, field: keyof PassengerDetail, value: string | number) => {
    const newDetails = [...details];
    newDetails[index] = { ...newDetails[index], [field]: value };
    setDetails(newDetails);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (details.some(d => !d.name || !d.seatNumber || d.age < 1)) {
      setError('Please fill in all passenger details');
      return;
    }
    setError('');
    onSubmit(details);
  };

  return (
    <section className="bg-white rounded-lg shadow-md p-6" aria-label="Passenger Details Form">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Passenger Details</h2>
      {error && <p className="text-red-500 mb-4" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {details.map((passenger, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor={`name-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                id={`name-${index}`}
                type="text"
                value={passenger.name}
                onChange={(e) => handleChange(index, 'name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                aria-required="true"
                aria-label={`Name for passenger ${index + 1}`}
              />
            </div>
            <div>
              <label htmlFor={`age-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                Age
              </label>
              <input
                id={`age-${index}`}
                type="number"
                value={passenger.age}
                onChange={(e) => handleChange(index, 'age', parseInt(e.target.value) || 18)}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                aria-required="true"
                aria-label={`Age for passenger ${index + 1}`}
              />
            </div>
            <div>
              <label htmlFor={`gender-${index}`} className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                id={`gender-${index}`}
                value={passenger.gender}
                onChange={(e) => handleChange(index, 'gender', e.target.value as 'male' | 'female')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`Gender for passenger ${index + 1}`}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
        ))}
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            aria-label="Back to seat selection"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            aria-label="Proceed to payment"
          >
            Continue
          </button>
        </div>
      </form>
    </section>
  );
}