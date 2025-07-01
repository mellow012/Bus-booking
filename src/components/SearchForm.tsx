'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Route } from '@/types';
import { Loader2, AlertCircle, MapPin, Calendar, Users } from 'lucide-react';
import AlertMessage from './alertMessage';

interface SearchFormProps {
  initialValues: {
    from: string;
    to: string;
    date: string;
    passengers: number;
  };
  onSearch: (values: {
    from: string;
    to: string;
    date: string;
    passengers: number;
  }) => void;
  loading: boolean;
}

export default function SearchForm({ initialValues, onSearch, loading }: SearchFormProps) {
  const [formData, setFormData] = useState(initialValues);
  const [cities, setCities] = useState<string[]>([]);
  const [popularRoutes, setPopularRoutes] = useState<{ from: string; to: string }[]>([]);
  const [error, setError] = useState('');
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchCitiesAndRoutes = async () => {
      setFetchLoading(true);
      setError('');
      try {
        const routesSnapshot = await getDocs(collection(db, 'routes'));
        if (!isMounted) return;

        const routes = routesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
        const uniqueCities = Array.from(
          new Set([...routes.map(r => r.origin), ...routes.map(r => r.destination)])
        ).sort();
        setCities(uniqueCities);
        setPopularRoutes(routes.slice(0, 4).map(r => ({ from: r.origin, to: r.destination })));
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.code === 'unavailable' ? 'Network error. Please check your connection.' : 'Failed to load cities. Please try again.');
      } finally {
        if (isMounted) setFetchLoading(false);
      }
    };

    fetchCitiesAndRoutes();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.from === formData.to) {
      setError('Departure and destination cities cannot be the same');
      return;
    }
    if (!formData.date || new Date(formData.date) < new Date(new Date().setHours(0, 0, 0, 0))) {
      setError('Please select a valid future date');
      return;
    }
    if (formData.passengers < 1 || formData.passengers > 6) {
      setError('Passengers must be between 1 and 6');
      return;
    }
    setError('');
    onSearch(formData);
  };

  if (fetchLoading) {
    return (
      <div className="flex justify-center items-center py-6">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error && !cities.length) {
    return <AlertMessage type="error" message={error} onClose={() => setError('')} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Bus Search Form">
      {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* From Field */}
        <div className="space-y-2">
          <label htmlFor="from" className="block text-sm font-semibold text-gray-800">
            From
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-600" />
            <select
              id="from"
              value={formData.from}
              onChange={(e) => setFormData({ ...formData, from: e.target.value })}
              className="w-full pl-10 pr-10 py-3 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200 appearance-none cursor-pointer font-medium"
              required
              aria-required="true"
              aria-label="Select departure city"
            >
              <option value="" className="text-gray-500">Select departure city</option>
              {cities.map((city) => (
                <option key={city} value={city} className="text-gray-800 font-medium">
                  {city}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* To Field */}
        <div className="space-y-2">
          <label htmlFor="to" className="block text-sm font-semibold text-gray-800">
            To
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-600" />
            <select
              id="to"
              value={formData.to}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              className="w-full pl-10 pr-10 py-3 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200 appearance-none cursor-pointer font-medium"
              required
              aria-required="true"
              aria-label="Select destination city"
            >
              <option value="" className="text-gray-500">Select destination city</option>
              {cities.map((city) => (
                <option key={city} value={city} className="text-gray-800 font-medium">
                  {city}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Date Field */}
        <div className="space-y-2">
          <label htmlFor="date" className="block text-sm font-semibold text-gray-800">
            Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-600" />
            <input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full pl-10 py-3 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200 font-medium cursor-pointer"
              required
              aria-required="true"
              aria-label="Select travel date"
            />
          </div>
        </div>

        {/* Passengers Field */}
        <div className="space-y-2">
          <label htmlFor="passengers" className="block text-sm font-semibold text-gray-800">
            Passengers
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-600" />
            <select
              id="passengers"
              value={formData.passengers}
              onChange={(e) => setFormData({ ...formData, passengers: parseInt(e.target.value) })}
              className="w-full pl-10 pr-10 py-3 text-gray-800 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200 appearance-none cursor-pointer font-medium"
              aria-label="Select number of passengers"
            >
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={num} className="text-gray-800 font-medium">
                  {num} {num === 1 ? 'Passenger' : 'Passengers'}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Search Button */}
      <div className="flex justify-center pt-4">
        <button
          type="submit"
          disabled={loading || fetchLoading}
          className="group relative px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md hover:shadow-lg"
          aria-label={loading ? 'Searching for buses' : 'Search for buses'}
        >
          <span className="flex items-center">
            {loading ? (
              <Loader2 className="animate-spin mr-3 h-5 w-5 text-white" />
            ) : (
              <svg className="mr-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            {loading ? 'Searching...' : 'Search Buses'}
          </span>
        </button>
      </div>

      {/* Popular Routes */}
      {popularRoutes.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Popular routes:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {popularRoutes.map((route, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setFormData({ ...formData, from: route.from, to: route.to })}
                className="px-3 py-1 text-sm bg-blue-50 hover:bg-blue-100 text-blue-800 hover:text-blue-900 rounded-full transition-colors duration-200 font-medium"
              >
                {route.from} → {route.to}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}