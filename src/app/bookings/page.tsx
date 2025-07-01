// File: src/app/bookings/page.tsx
'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc, orderBy, updateDoc, increment, arrayRemove, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Booking, Schedule, Bus, Route, Company, SearchFilterss, UserProfile } from '@/types';
import { Bus as BusIcon, Map, Clock, Currency, Download, XCircle, CheckCircle, Loader2, Search, CreditCard, User, Mail, Phone, Armchair } from 'lucide-react';
import Modal from '../../components/Modals';
import AlertMessage from '../../components/alertMessage';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

interface BookingWithDetails extends Booking {
  schedule: Schedule;
  bus: Bus;
  route: Route;
  company: Company;
}

const BookingsPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState<SearchFilterss>({});
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [userDetails, setUserDetails] = useState({
    name: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(),
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (searchParams.get('success') === 'true') {
      setSuccess('Booking confirmed successfully!');
      setTimeout(() => setSuccess(''), 5000);
    }

    fetchBookings();
  }, [user, router, searchParams, userProfile]);

  const fetchBookings = async () => {
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        bookingDate: (doc.data().bookingDate as Timestamp).toDate(),
        createdAt: (doc.data().createdAt as Timestamp).toDate(),
        updatedAt: (doc.data().updatedAt as Timestamp).toDate(),
      })) as Booking[];

      const bookingsWithDetails: BookingWithDetails[] = [];
      for (const booking of bookingsData) {
        try {
          const scheduleDoc = await getDoc(doc(db, 'schedules', booking.scheduleId));
          if (!scheduleDoc.exists()) continue;
          const schedule = { id: scheduleDoc.id, ...scheduleDoc.data() } as Schedule;

          const busDoc = await getDoc(doc(db, 'buses', schedule.busId));
          if (!busDoc.exists()) continue;
          const bus = { id: busDoc.id, ...busDoc.data() } as Bus;

          const routeDoc = await getDoc(doc(db, 'routes', schedule.routeId));
          if (!routeDoc.exists()) continue;
          const route = { id: routeDoc.id, ...routeDoc.data() } as Route;

          const companyDoc = await getDoc(doc(db, 'companies', booking.companyId));
          if (!companyDoc.exists()) continue;
          const company = { id: companyDoc.id, ...companyDoc.data() } as Company;

          // Validate seatNumbers match passengerDetails
          if (booking.seatNumbers.length !== booking.passengerDetails.length ||
              !booking.seatNumbers.every(sn => booking.passengerDetails.some(pd => pd.seatNumber === sn))) {
            console.warn(`Seat mismatch in booking ${booking.id}`);
            continue;
          }

          bookingsWithDetails.push({
            ...booking,
            schedule,
            bus,
            route,
            company,
          });
        } catch (error) {
          console.error('Error fetching booking details:', error);
        }
      }

      setBookings(bookingsWithDetails);
      setFilteredBookings(bookingsWithDetails);
    } catch (error) {
      setError('Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'priceRangeMin' || name === 'priceRangeMax') {
      setFilters(prev => ({
        ...prev,
        priceRange: { ...prev.priceRange, [name === 'priceRangeMin' ? 'min' : 'max']: value ? Number(value) : undefined },
      }));
    } else if (name === 'departureTimeStart' || name === 'departureTimeEnd') {
      setFilters(prev => ({
        ...prev,
        departureTime: { ...prev.departureTime, [name === 'departureTimeStart' ? 'start' : 'end']: value },
      }));
    } else if (name === 'amenities') {
      setFilters(prev => ({ ...prev, amenities: value ? [value] : undefined }));
    } else {
      setFilters(prev => ({ ...prev, [name]: value || undefined }));
    }
    const filtered = bookings.filter(booking => {
      const { bus, route, schedule, company } = booking;
      const matchesBusType = !filters.busType || bus.busType === filters.busType;
      const matchesPrice = !filters.priceRange || (
        schedule.price >= (filters.priceRange.min || 0) &&
        schedule.price <= (filters.priceRange.max || Infinity)
      );
      const matchesTime = !filters.departureTime || (
        new Date(schedule.departureTime).toISOString().slice(11, 16) >= (filters.departureTime.start || '00:00') &&
        new Date(schedule.departureTime).toISOString().slice(11, 16) <= (filters.departureTime.end || '23:59')
      );
      const matchesAmenities = !filters.amenities || filters.amenities.every(a => bus.amenities.includes(a));
      const matchesCompany = !filters.company || company.name === filters.company;
      return matchesBusType && matchesPrice && matchesTime && matchesAmenities && matchesCompany;
    });
    setFilteredBookings(filtered);
  };

  const handleCancelBooking = async (bookingId: string, scheduleId: string, seatNumbers: string[]) => {
    setActionLoading(bookingId);
    setError('');
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        bookingStatus: 'cancelled',
        updatedAt: new Date(),
      });
      await updateDoc(doc(db, 'schedules', scheduleId), {
        availableSeats: increment(seatNumbers.length),
        bookedSeats: arrayRemove(...seatNumbers),
        updatedAt: new Date(),
      });
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, bookingStatus: 'cancelled' } : b));
      setFilteredBookings(prev => prev.map(b => b.id === bookingId ? { ...b, bookingStatus: 'cancelled' } : b));
      setSuccess('Booking cancelled successfully! Seats released.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(`Failed to cancel booking: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadTicket = async (booking: BookingWithDetails, includeQR: boolean) => {
    const pdf = new jsPDF();
    pdf.setFontSize(12);
    pdf.text('Malawi Bus Booking - Ticket', 20, 20);
    pdf.text(`Booking ID: ${booking.id.slice(-8).toUpperCase()}`, 20, 30);
    pdf.text('Company Details', 20, 40);
    pdf.text(`Name: ${booking.company.name}`, 20, 50);
    pdf.text(`Email: ${booking.company.email}`, 20, 60);
    pdf.text(`Phone: ${booking.company.phone}`, 20, 70);
    pdf.text('Trip Details', 20, 80);
    pdf.text(`Route: ${booking.route.origin} to ${booking.route.destination}`, 20, 90);
    pdf.text(`Stops: ${booking.route.stops.join(', ') || 'None'}`, 20, 100);
    pdf.text(`Date: ${new Date(booking.schedule.date).toLocaleDateString('en-GB')}`, 20, 110);
    pdf.text(`Departure: ${new Date(booking.schedule.departureTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 20, 120);
    pdf.text(`Arrival: ${new Date(booking.schedule.arrivalTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 20, 130);
    pdf.text(`Duration: ${booking.route.duration} minutes`, 20, 140);
    pdf.text('Bus Details', 20, 150);
    pdf.text(`Type: ${booking.bus.busType} (${booking.bus.busNumber})`, 20, 160);
    pdf.text(`Amenities: ${booking.bus.amenities.join(', ') || 'None'}`, 20, 170);
    pdf.text('Seat Details', 20, 180);
    pdf.text(`Seats Assigned: ${booking.seatNumbers.join(', ')}`, 20, 190);
    pdf.text(`Status: ${booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid' ? 'Assigned' : 'Pending'}`, 20, 200);
    pdf.text('Passenger Details', 20, 210);
    booking.passengerDetails.forEach((p, i) => {
      pdf.text(`${p.name} (Age: ${p.age}, Gender: ${p.gender}, Seat: ${p.seatNumber})`, 30, 220 + i * 10);
    });
    pdf.text('Payment Details', 20, 240 + booking.passengerDetails.length * 10);
    pdf.text(`Total: MWK ${booking.totalAmount.toLocaleString()}`, 20, 250 + booking.passengerDetails.length * 10);
    pdf.text(`Status: ${booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}`, 20, 260 + booking.passengerDetails.length * 10);
    pdf.text(`Payment Service: ${booking.paymentService || 'Pending'}`, 20, 270 + booking.passengerDetails.length * 10);
    pdf.text(`Transaction ID: ${booking.transactionId || 'Pending'}`, 20, 280 + booking.passengerDetails.length * 10);

    if (includeQR && booking.bookingStatus === 'confirmed') {
      const arrivalTime = new Date(booking.schedule.arrivalTime);
      const qrExpiration = new Date(arrivalTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours after arrival
      const qrData = `https://yourapp.com/verify?bookingId=${booking.id}&seats=${booking.seatNumbers.join(',')}&expires=${qrExpiration.toISOString()}`;
      const qrCode = await QRCode.toDataURL(qrData, { width: 100 });
      pdf.addImage(qrCode, 'PNG', 150, 20, 40, 40);
      pdf.text(`QR Code (Expires: ${qrExpiration.toLocaleString('en-GB')})`, 150, 65);
    }

    pdf.save(`ticket_${booking.id.slice(-8)}.pdf`);
  };

  const handleConfirmDetails = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setUserDetails({
      name: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(),
      email: userProfile?.email || '',
      phone: userProfile?.phone || '',
    });
    setConfirmModalOpen(true);
  };

  const handleConfirmSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    if (!userDetails.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!userDetails.email.trim() || !userDetails.email.includes('@')) {
      setError('Valid email is required');
      return;
    }
    if (!userDetails.phone.trim() || !/^\+265[0-9]{9}$/.test(userDetails.phone.replace(/[\s-]/g, ''))) {
      setError('Phone number must be in +265 format (e.g., +265123456789)');
      return;
    }
    // Validate seat availability
    const scheduleDoc = await getDoc(doc(db, 'schedules', selectedBooking.scheduleId));
    if (!scheduleDoc.exists()) {
      setError('Schedule not found');
      return;
    }
    const schedule = scheduleDoc.data() as Schedule;
    if (schedule.availableSeats < selectedBooking.seatNumbers.length) {
      setError('Selected seats are no longer available');
      return;
    }
    setConfirmModalOpen(false);
    setPaymentModalOpen(true);
  };

  const handlePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setActionLoading(selectedBooking.id);
    setError('');
    try {
      const mockTransactionId = `TXN-${uuidv4().slice(0, 8)}`;
      await updateDoc(doc(db, 'bookings', selectedBooking.id), {
        paymentStatus: 'paid',
        paymentService: 'PayChangu',
        transactionId: mockTransactionId,
        updatedAt: new Date(),
      });
      await updateDoc(doc(db, 'companies', selectedBooking.companyId), {
        paymentService: 'PayChangu',
        transactionId: mockTransactionId,
        updatedAt: new Date(),
      });
      setBookings(prev =>
        prev.map(b =>
          b.id === selectedBooking.id
            ? { ...b, paymentStatus: 'paid', paymentService: 'PayChangu', transactionId: mockTransactionId }
            : b
        )
      );
      setFilteredBookings(prev =>
        prev.map(b =>
          b.id === selectedBooking.id
            ? { ...b, paymentStatus: 'paid', paymentService: 'PayChangu', transactionId: mockTransactionId }
            : b
        )
      );
      setSuccess(`Payment processed! Seats ${selectedBooking.seatNumbers.join(', ')} confirmed.`);
      setPaymentModalOpen(false);
      setSelectedBooking(null);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(`Failed to process payment: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const formatTime = (time: string) => {
    return new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeatStatus = (booking: BookingWithDetails) => {
    return booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid' ? 'Assigned' : 'Pending';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {success && <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />}
        {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">My Bookings</h1>
              <p className="text-sm text-gray-600 mt-1">Manage and view your bus ticket bookings</p>
            </div>
            <button
              onClick={() => router.push('/search')}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              <Search size={20} />
              <span>Book New Ticket</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <BusIcon className="w-5 h-5 text-black" />
                <span>Bus Type</span>
              </label>
              <select
                name="busType"
                value={filters.busType || ''}
                onChange={handleFilterChange}
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="">All Bus Types</option>
                {['AC', 'Non-AC', 'Sleeper', 'Semi-Sleeper'].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <Currency className="w-5 h-5 text-red-600" />
                <span>Price Range</span>
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  name="priceRangeMin"
                  placeholder="Min"
                  value={filters.priceRange?.min || ''}
                  onChange={handleFilterChange}
                  className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
                <input
                  type="number"
                  name="priceRangeMax"
                  placeholder="Max"
                  value={filters.priceRange?.max || ''}
                  onChange={handleFilterChange}
                  className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <Clock className="w-5 h-5 text-green-600" />
                <span>Departure Time</span>
              </label>
              <div className="flex space-x-2">
                <input
                  type="time"
                  name="departureTimeStart"
                  value={filters.departureTime?.start || ''}
                  onChange={handleFilterChange}
                  className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
                <input
                  type="time"
                  name="departureTimeEnd"
                  value={filters.departureTime?.end || ''}
                  onChange={handleFilterChange}
                  className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <Map className="w-5 h-5 text-red-600" />
                <span>Amenities</span>
              </label>
              <select
                name="amenities"
                value={filters.amenities?.[0] || ''}
                onChange={handleFilterChange}
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="">All Amenities</option>
                {['WiFi', 'Charging', 'AC', 'TV', 'Water'].map(amenity => (
                  <option key={amenity} value={amenity}>{amenity}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <Map className="w-5 h-5 text-red-600" />
                <span>Company</span>
              </label>
              <select
                name="company"
                value={filters.company || ''}
                onChange={handleFilterChange}
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="">All Companies</option>
                {[...new Set(bookings.map(b => b.company.name))].map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <BusIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No bookings found</h3>
            <p className="text-sm text-gray-600 mb-6">You haven't made any bus bookings yet. Start planning your journey!</p>
            <button
              onClick={() => router.push('/search')}
              className="flex items-center space-x-2 mx-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              <Search size={20} />
              <span>Search Buses</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredBookings.map(booking => (
              <div key={booking.id} className="bg-white rounded-lg shadow-md p-6 transform hover:shadow-lg transition hover:-translate-y-1">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-2">
                    <div className="flex items-center space-x-3 mb-4">
                      <img
                        src={booking.company.logo || 'https://placehold.co/100x100/e2e8f0/64748b?text=Logo'}
                        alt={`${booking.company.name} Logo`}
                        className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{booking.company.name}</h3>
                        <p className="text-sm text-gray-600">{booking.company.email} | {booking.company.phone}</p>
                      </div>
                      <div className="ml-auto flex space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.bookingStatus)}`}>
                          {booking.bookingStatus.charAt(0).toUpperCase() + booking.bookingStatus.slice(1)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(booking.paymentStatus)}`}>
                          {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-800">{formatTime(booking.schedule.departureTime)}</div>
                        <div className="text-sm text-gray-600">{booking.route.origin}</div>
                      </div>
                      <div className="flex-1 mx-4">
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                          </div>
                          <div className="relative flex justify-center text-sm">
                            <span className="bg-white px-2 text-gray-600">{formatDate(booking.schedule.date)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-800">{formatTime(booking.schedule.arrivalTime)}</div>
                        <div className="text-sm text-gray-600">{booking.route.destination}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex items-center space-x-2">
                        <BusIcon className="w-5 h-5 text-black" />
                        <p>Bus: {booking.bus.busType} ({booking.bus.busNumber})</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Map className="w-5 h-5 text-red-600" />
                        <p>Stops: {booking.route.stops.join(', ') || 'None'}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-5 h-5 text-green-600" />
                        <p>Duration: {booking.route.duration} minutes</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Currency className="w-5 h-5 text-red-600" />
                        <p>Amenities: {booking.bus.amenities.join(', ') || 'None'}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Armchair className="w-5 h-5 text-black" />
                        <p>Seats: {booking.seatNumbers.join(', ')} ({getSeatStatus(booking)})</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="w-5 h-5 text-black" />
                        <p>Passengers: {booking.passengerDetails.length}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-5 h-5 text-green-600" />
                        <p>Booking Date: {formatDate(booking.bookingDate)}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center space-x-2">
                      <User className="w-5 h-5 text-black" />
                      <span>Passengers & Seats</span>
                    </h4>
                    <div className="space-y-2">
                      {booking.passengerDetails.map((passenger, index) => (
                        <div key={index} className="text-sm">
                          <p className="font-medium text-gray-800">{passenger.name}</p>
                          <p className="text-gray-600">
                            Age: {passenger.age} • Gender: {passenger.gender} • Seat: {passenger.seatNumber} ({getSeatStatus(booking)})
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="mb-4">
                      <div className="text-lg font-semibold text-gray-800">MWK {booking.totalAmount.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Total Amount</div>
                      <div className="text-sm text-gray-600">Payment Service: {booking.paymentService || 'Pending'}</div>
                      <div className="text-sm text-gray-600">Transaction ID: {booking.transactionId || 'Pending'}</div>
                    </div>
                    <div className="space-y-2">
                      {booking.paymentStatus !== 'paid' && (
                        <button
                          onClick={() => handleConfirmDetails(booking)}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                          disabled={actionLoading === booking.id}
                        >
                          <CreditCard size={20} />
                          <span>Pay Now</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadTicket(booking, true)}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
                        disabled={actionLoading === booking.id}
                      >
                        <Download size={20} />
                        <span>Download Ticket (QR)</span>
                      </button>
                      <button
                        onClick={() => handleDownloadTicket(booking, false)}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
                        disabled={actionLoading === booking.id}
                      >
                        <Download size={20} />
                        <span>Download Ticket</span>
                      </button>
                      {booking.bookingStatus === 'confirmed' && (
                        <button
                          onClick={() => handleCancelBooking(booking.id, booking.scheduleId, booking.seatNumbers)}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                          disabled={actionLoading === booking.id}
                        >
                          {actionLoading === booking.id ? (
                            <Loader2 className="animate-spin w-5 h-5 mr-2" />
                          ) : (
                            <XCircle size={20} />
                          )}
                          <span>Cancel Booking</span>
                        </button>
                      )}
                    </div>
                    <div className="mt-4 text-xs text-gray-600">
                      Booking ID: {booking.id.slice(-8).toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Confirm Your Details"
        >
          <form onSubmit={handleConfirmSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">Please verify your details and seats before proceeding to payment.</p>
            {selectedBooking && (
              <div className="text-sm text-gray-600">
                <p className="font-medium">Selected Seats: {selectedBooking.seatNumbers.join(', ')}</p>
                <p>Passengers:</p>
                {selectedBooking.passengerDetails.map((p, i) => (
                  <p key={i} className="ml-2">• {p.name} (Seat: {p.seatNumber})</p>
                ))}
              </div>
            )}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <User className="w-5 h-5 text-black" />
                <span>Name</span>
              </label>
              <input
                type="text"
                value={userDetails.name}
                onChange={e => setUserDetails({ ...userDetails, name: e.target.value })}
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <Mail className="w-5 h-5 text-green-600" />
                <span>Email</span>
              </label>
              <input
                type="email"
                value={userDetails.email}
                onChange={e => setUserDetails({ ...userDetails, email: e.target.value })}
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <Phone className="w-5 h-5 text-black" />
                <span>Phone (+265)</span>
              </label>
              <input
                type="tel"
                value={userDetails.phone}
                onChange={e => setUserDetails({ ...userDetails, phone: e.target.value })}
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                required
                pattern="\+265[0-9]{9}"
                title="Phone number must start with +265 followed by 9 digits"
              />
            </div>
            {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={actionLoading !== null}
            >
              <CheckCircle size={20} />
              <span>Confirm and Proceed</span>
            </button>
          </form>
        </Modal>

        <Modal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          title="Pay with PayChangu"
        >
          <form onSubmit={handlePayment} className="space-y-4">
            <p className="text-sm text-gray-600">Complete payment for your selected seats.</p>
            {selectedBooking && (
              <div className="text-sm text-gray-600">
                <p className="font-medium">Selected Seats: {selectedBooking.seatNumbers.join(', ')}</p>
                <p>Passengers:</p>
                {selectedBooking.passengerDetails.map((p, i) => (
                  <p key={i} className="ml-2">• {p.name} (Seat: {p.seatNumber})</p>
                ))}
              </div>
            )}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <Currency className="w-5 h-5 text-red-600" />
                <span>Amount</span>
              </label>
              <input
                type="number"
                value={selectedBooking?.totalAmount || ''}
                disabled
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 bg-gray-100"
              />
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <CreditCard className="w-5 h-5 text-green-600" />
                <span>Payment Service</span>
              </label>
              <input
                type="text"
                value="PayChangu"
                disabled
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 bg-gray-100"
              />
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <User className="w-5 h-5 text-black" />
                <span>Sender Name</span>
              </label>
              <input
                type="text"
                value={userDetails.name}
                disabled
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 bg-gray-100"
              />
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <Phone className="w-5 h-5 text-black" />
                <span>Sender Phone (+265)</span>
              </label>
              <input
                type="tel"
                value={userDetails.phone}
                disabled
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 bg-gray-100"
              />
            </div>
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                <CreditCard className="w-5 h-5 text-green-600" />
                <span>Transaction ID</span>
              </label>
              <input
                type="text"
                value={`TXN-${uuidv4().slice(0, 8)}`}
                disabled
                className="mt-1 w-full p-2 border rounded-md text-lg text-gray-800 bg-gray-100"
              />
            </div>
            {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={actionLoading !== null}
            >
              <CreditCard size={20} />
              <span>Proceed with PayChangu (Mock)</span>
            </button>
          </form>
        </Modal>
      </div>
    </div>
  );
};

export default BookingsPage;
