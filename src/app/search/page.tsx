'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import SearchForm from '@/components/SearchForm';
import SearchFilters from '@/components/SearchFiltersComponent';
import { Schedule, Company, Bus, Route, SearchFilterss } from '@/types';
import {  Bus as BusIcon, Map, Clock, Currency, Loader2, AlertCircle } from 'lucide-react';
import AlertMessage from '../../components/alertMessage';

interface SearchCriteria {
  from: string;
  to: string;
  date: string;
  passengers: number;
}

interface SearchResult {
  schedule: Schedule;
  company: Company;
  bus: Bus;
  route: Route;
}

export default function Search() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialSearchCriteria = useMemo<SearchCriteria>(() => ({
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    date: searchParams.get('date') ?? '',
    passengers: Math.max(1, parseInt(searchParams.get('passengers') ?? '1', 10)),
  }), [searchParams]);

  const [searchState, setSearchState] = useState<{
    results: SearchResult[];
    loading: boolean;
    error: string;
  }>({
    results: [],
    loading: false,
    error: '',
  });

  const [filters, setFilters] = useState<SearchFilterss>({});

  const searchBuses = useCallback(async () => {
    const { from, to, date, passengers } = initialSearchCriteria;
    if (!from || !to || !date || passengers < 1) {
      setSearchState(prev => ({ ...prev, error: 'Please provide valid search criteria', loading: false }));
      return;
    }

    setSearchState(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const schedulesQuery = query(
        collection(db, 'schedules'),
        where('isActive', '==', true),
        where('availableSeats', '>=', passengers)
      );
      const schedulesSnapshot = await getDocs(schedulesQuery);
      console.log('Search schedules found:', schedulesSnapshot.docs.length); // Debug log
      const results: SearchResult[] = [];

      for (const scheduleDoc of schedulesSnapshot.docs) {
        const schedule = { id: scheduleDoc.id, ...scheduleDoc.data() } as Schedule;
        const routeDoc = await getDoc(doc(db, 'routes', schedule.routeId));
        if (!routeDoc.exists()) {
          console.warn(`Route not found for ID: ${schedule.routeId}`);
          continue;
        }
        const route = { id: routeDoc.id, ...routeDoc.data() } as Route;

        if (route.origin !== from || route.destination !== to || schedule.date !== date) continue;

        const companyDoc = await getDoc(doc(db, 'companies', schedule.companyId));
        if (!companyDoc.exists()) {
          console.warn(`Company not found for ID: ${schedule.companyId}`);
          continue;
        }
        const company = { id: companyDoc.id, ...companyDoc.data() } as Company;

        const busDoc = await getDoc(doc(db, 'buses', schedule.busId));
        if (!busDoc.exists()) {
          console.warn(`Bus not found for ID: ${schedule.busId}`);
          continue;
        }
        const bus = { id: busDoc.id, ...busDoc.data() } as Bus;

        results.push({ schedule, company, bus, route });
      }

      console.log('Search results:', results.length); // Debug log
      setSearchState(prev => ({
        ...prev,
        results,
        loading: false,
      }));
    } catch (err: any) {
      setSearchState(prev => ({
        ...prev,
        error: err.code === 'unavailable' ? 'Network error. Please check your connection.' : 'Failed to load search results. Please try again.',
        loading: false,
        results: [],
      }));
      console.error('Search error:', err);
    }
  }, [initialSearchCriteria]);

  useEffect(() => {
    searchBuses();
  }, [searchBuses]);

  const filteredResults = useMemo(() => {
    let results = searchState.results;

    if (filters.busType) {
      results = results.filter(result => result.bus.busType === filters.busType);
    }
    if (filters.company) {
      results = results.filter(result => result.company.name === filters.company);
    }
    if (filters.amenities?.length) {
      results = results.filter(result =>
        filters.amenities!.every(amenity => result.bus.amenities.includes(amenity))
      );
    }
    if (filters.priceRange) {
      const { min, max } = filters.priceRange;
      results = results.filter(result => 
        result.schedule.price >= min && result.schedule.price <= max
      );
    }
    if (filters.departureTime) {
      const { start, end } = filters.departureTime;
      results = results.filter(result => {
        const departureTime = new Date(result.schedule.departureTime).getHours();
        return departureTime >= parseInt(start.split(':')[0]) && departureTime <= parseInt(end.split(':')[0]);
      });
    }

    return results;
  }, [searchState.results, filters]);

  const handleSearch = useCallback((newCriteria: SearchCriteria) => {
    const urlParams = new URLSearchParams({
      from: newCriteria.from,
      to: newCriteria.to,
      date: newCriteria.date,
      passengers: newCriteria.passengers.toString(),
    });
    router.push(`/search?${urlParams.toString()}`, { scroll: false });
  }, [router]);

  const handleFiltersChange = useCallback((newFilters: SearchFilterss) => {
    setFilters(newFilters);
  }, []);

  const hasValidSearchCriteria = initialSearchCriteria.from && initialSearchCriteria.to && initialSearchCriteria.date;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Find Your Bus</h1>
          <p className="text-gray-600">Search and compare bus routes to find the best option for your journey</p>
        </header>

        <section aria-label="Bus Search Form" className="mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <SearchForm
              initialValues={initialSearchCriteria}
              onSearch={handleSearch}
              loading={searchState.loading}
            />
          </div>
        </section>

        {hasValidSearchCriteria && (
          <section aria-label="Search Results" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <aside className="lg:col-span-1" aria-label="Search Filters">
              <div className="sticky top-4">
                <SearchFilters 
                  filters={filters} 
                  onFiltersChange={handleFiltersChange} 
                  results={searchState.results} 
                />
              </div>
            </aside>

            <main className="lg:col-span-3" aria-live="polite" aria-label="Bus Search Results">
              {searchState.error && (
                <AlertMessage type="error" message={searchState.error} onClose={() => setSearchState(prev => ({ ...prev, error: '' }))} />
              )}

              {!searchState.loading && !searchState.error && searchState.results.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Found <span className="font-semibold">{searchState.results.length}</span> buses
                    {filteredResults.length !== searchState.results.length && (
                      <span>, showing <span className="font-semibold">{filteredResults.length}</span> after filters</span>
                    )}
                  </p>
                </div>
              )}

              {searchState.loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : filteredResults.length === 0 && !searchState.error ? (
                <div className="text-center py-12">
                  <BusIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No buses found for this route. Try adjusting your search or selecting a different date.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                  {filteredResults.map(result => (
                    <article
                      key={result.schedule.id}
                      className="group bg-white rounded-lg shadow-md p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border border-gray-200 cursor-pointer"
                      onClick={() => router.push(`/bus/${result.schedule.id}`)}
                    >
                      <div className="flex items-center space-x-4 mb-4">
                        <img
                          src={result.company.logo || 'https://placehold.co/100x100/e2e8f0/64748b?text=Logo'}
                          alt={`${result.company.name} Logo`}
                          className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800 group-hover:text-blue-800">
                            {result.company.name}
                          </h3>
                          <p className="text-sm text-gray-600">{result.bus.busType} ({result.bus.busNumber})</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Map className="w-5 h-5 text-blue-600" />
                          <p>{result.route.origin} to {result.route.destination}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-5 h-5 text-blue-600" />
                          <p>Departs: {new Date(result.schedule.departureTime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Currency className="w-5 h-5 text-blue-600" />
                          <p>Price: MWK {result.schedule.price.toLocaleString()} per seat</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <BusIcon className="w-5 h-5 text-blue-600" />
                          <p>Seats Available: {result.schedule.availableSeats}</p>
                        </div>
                      </div>
                      <button
                        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                      >
                        View Details
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </main>
          </section>
        )}

        {!hasValidSearchCriteria && !searchState.loading && (
          <div className="text-center py-12">
            <BusIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Enter your departure and destination cities above to find available buses.</p>
          </div>
        )}
      </div>
    </div>
  );
}