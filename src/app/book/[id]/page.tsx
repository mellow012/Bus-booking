'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Schedule, Bus, Route, Company, PassengerDetail } from '@/types';
import SeatSelection from '@/components/SeatSelection';
import PassengerForm from '@/components/PassengerForm';

export default function BookBus() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const scheduleId = params.id as string;
  const passengers = parseInt(searchParams.get('passengers') || '1');

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [bus, setBus] = useState<Bus | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengerDetails, setPassengerDetails] = useState<PassengerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState<'seats' | 'passengers' | 'payment'>('seats');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchBookingData();
  }, [scheduleId, user]);

  const fetchBookingData = async () => {
    try {
      const scheduleDoc = await getDoc(doc(db, 'schedules', scheduleId));
      if (!scheduleDoc.exists()) {
        throw new Error('Schedule not found');
      }
      const scheduleData = { id: scheduleDoc.id, ...scheduleDoc.data() } as Schedule;
      setSchedule(scheduleData);

      const busDoc = await getDoc(doc(db, 'buses', scheduleData.busId));
      if (busDoc.exists()) {
        setBus({ id: busDoc.id, ...busDoc.data() } as Bus);
      }

      const routeDoc = await getDoc(doc(db, 'routes', scheduleData.routeId));
      if (routeDoc.exists()) {
        setRoute({ id: routeDoc.id, ...routeDoc.data() } as Route);
      }

      const companyDoc = await getDoc(doc(db, 'companies', scheduleData.companyId));
      if (companyDoc.exists()) {
        setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
      }
    } catch (error) {
      setError('Error fetching booking data');
      console.error('Error fetching booking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeatSelection = (seats: string[]) => {
    setSelectedSeats(seats);
    if (seats.length === passengers) {
      setCurrentStep('passengers');
      const initialDetails = seats.map(seat => ({
        name: '',
        age: 18,
        gender: 'male' as const,
        seatNumber: seat,
      }));
      setPassengerDetails(initialDetails);
    }
  };

  const handlePassengerDetails = (details: PassengerDetail[]) => {
    setPassengerDetails(details);
    setCurrentStep('payment');
  };

  const handleBooking = async () => {
    if (!user || !schedule || !userProfile) {
      setError('User or schedule data missing');
      return;
    }

    if (passengerDetails.some(p => !p.name || !p.seatNumber)) {
      setError('Please fill in all passenger details');
      return;
    }

    setBookingLoading(true);
    try {
      const booking = {
        userId: user.uid,
        scheduleId: schedule.id,
        companyId: schedule.companyId,
        passengerDetails,
        seatNumbers: selectedSeats,
        totalAmount: schedule.price * passengers,
        bookingStatus: 'confirmed' as const,
        paymentStatus: 'paid' as const,
        paymentId: `payment_${Date.now()}`,
        bookingDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'bookings'), booking);
      await updateDoc(doc(db, 'schedules', schedule.id), {
        bookedSeats: arrayUnion(...selectedSeats),
        availableSeats: schedule.availableSeats - passengers,
      });

      router.push('/bookings?success=true');
    } catch (error) {
      setError('Error creating booking');
      console.error('Error creating booking:', error);
    } finally {
      setBookingLoading(false);
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!schedule || !bus || !route || !company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Not Found</h2>
          <p className="text-gray-600 mb-4">The requested booking could not be found.</p>
          <button
            onClick={() => router.push('/search')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            aria-label="Return to search page"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section aria-label="Book Your Bus Journey">
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Book Your Journey</h1>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold" aria-hidden="true">{company.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{company.name}</p>
                    <p className="text-sm text-gray-600">{bus.busNumber} • {bus.busType}</p>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatTime(schedule.departureTime)}
                    </p>
                    <p className="text-sm text-gray-600">{route.origin}</p>
                  </div>
                  <div className="flex-1 max-w-20">
                    <div className="border-t border-gray-300"></div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDuration(route.duration)}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatTime(schedule.arrivalTime)}
                    </p>
                    <p className="text-sm text-gray-600">{route.destination}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">{schedule.date}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-600">${schedule.price}</p>
                <p className="text-sm text-gray-600">per person</p>
                <p className="text-sm text-gray-600">{passengers} passenger{passengers > 1 ? 's' : ''}</p>
                <p className="text-lg font-semibold text-gray-900 mt-2">
                  Total: ${schedule.price * passengers}
                </p>
              </div>
            </div>
            {bus.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {bus.amenities.slice(0, 4).map((amenity, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {amenity}
                  </span>
                ))}
                {bus.amenities.length > 4 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    +{bus.amenities.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <nav className="flex items-center justify-center space-x-8" aria-label="Booking Progress">
              <div className={`flex items-center space-x-2 ${currentStep === 'seats' ? 'text-blue-600' : 'text-green-600'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'seats' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
                  1
                </div>
                <span className="font-medium">Select Seats</span>
              </div>
              <div className={`flex items-center space-x-2 ${currentStep === 'passengers' ? 'text-blue-600' : currentStep === 'payment' ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'passengers' ? 'bg-blue-600 text-white' : currentStep === 'payment' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                  2
                </div>
                <span className="font-medium">Passenger Details</span>
              </div>
              <div className={`flex items-center space-x-2 ${currentStep === 'payment' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'payment' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  3
                </div>
                <span className="font-medium">Payment</span>
              </div>
            </nav>
          </div>
          <div aria-live="polite">
            {error && <p className="text-red-500 mb-4" role="alert">{error}</p>}
            {currentStep === 'seats' && (
              <SeatSelection
                bus={bus}
                schedule={schedule}
                passengers={passengers}
                onSeatSelection={handleSeatSelection}
              />
            )}
            {currentStep === 'passengers' && (
              <PassengerForm
                passengerDetails={passengerDetails}
                onSubmit={handlePassengerDetails}
                onBack={() => setCurrentStep('seats')}
              />
            )}
            {currentStep === 'payment' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Booking Summary</h2>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Route:</span>
                    <span className="font-medium">{route.origin} → {route.destination}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">{schedule.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Departure:</span>
                    <span className="font-medium">{formatTime(schedule.departureTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Seats:</span>
                    <span className="font-medium">{selectedSeats.join(', ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Passengers:</span>
                    <span className="font-medium">{passengers}</span>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Amount:</span>
                      <span className="text-blue-600">${schedule.price * passengers}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setCurrentStep('passengers')}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                    aria-label="Back to passenger details"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleBooking}
                    disabled={bookingLoading}
                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                    aria-label="Confirm booking"
                  >
                    {bookingLoading ? 'Processing...' : 'Confirm Booking'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}