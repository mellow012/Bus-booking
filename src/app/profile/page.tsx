'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { BookingWithDetails, UserProfile, Schedule, Company, Bus, Route } from '@/types';
import { Loader2, AlertCircle, User, Map, Clock, Currency, Bus as BusIcon, Armchair, XCircle, Download, QrCode } from 'lucide-react';
import AlertMessage from '../../components/alertMessage';
import Modal from '../../components/Modals';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editProfile, setEditProfile] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', phone: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState<{ open: boolean; bookingId: string }>({ open: false, bookingId: '' });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          setError('User profile not found');
          return;
        }
        const userData = { id: userDoc.id, ...userDoc.data() } as UserProfile;
        setProfile(userData);
        setFormData({
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
        });

        // Fetch user bookings
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('userId', '==', user.uid)
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        const bookingsData: BookingWithDetails[] = [];
        for (const bookingDoc of bookingsSnapshot.docs) {
          const booking = { id: bookingDoc.id, ...bookingDoc.data() } as BookingWithDetails;
          const scheduleDoc = await getDoc(doc(db, 'schedules', booking.scheduleId));
          if (!scheduleDoc.exists()) continue;
          const schedule = { id: scheduleDoc.id, ...scheduleDoc.data() } as Schedule;

          const companyDoc = await getDoc(doc(db, 'companies', booking.companyId));
          if (!companyDoc.exists()) continue;
          const company = { id: companyDoc.id, ...companyDoc.data() } as Company;

          const busDoc = await getDoc(doc(db, 'buses', schedule.busId));
          if (!busDoc.exists()) continue;
          const bus = { id: busDoc.id, ...busDoc.data() } as Bus;

          const routeDoc = await getDoc(doc(db, 'routes', schedule.routeId));
          if (!routeDoc.exists()) continue;
          const route = { id: routeDoc.id, ...routeDoc.data() } as Route;

          bookingsData.push({ ...booking, schedule, company, bus, route });
        }
        setBookings(bookingsData);
      } catch (err: any) {
        setError('Failed to load profile or bookings. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, router]);

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }
    if (!formData.phone.match(/^\+265\d{9}$/)) {
      setError('Phone must be in +265 format (e.g., +265999123456)');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        updatedAt: Timestamp.now(),
      });
      setProfile({ ...profile, firstName: formData.firstName, lastName: formData.lastName, phone: formData.phone });
      setEditProfile(false);
    } catch (err: any) {
      setError(`Failed to update profile: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!user) return;
    setActionLoading(true);
    setError('');
    try {
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      if (!bookingDoc.exists()) {
        setError('Booking not found');
        return;
      }
      const booking = bookingDoc.data() as BookingWithDetails;
      if (booking.userId !== user.uid) {
        setError('You can only cancel your own bookings');
        return;
      }
      if (booking.bookingStatus === 'cancelled') {
        setError('Booking is already cancelled');
        return;
      }

      const scheduleDoc = await getDoc(doc(db, 'schedules', booking.scheduleId));
      if (!scheduleDoc.exists()) {
        setError('Schedule not found');
        return;
      }
      const schedule = scheduleDoc.data() as Schedule;

      await updateDoc(doc(db, 'bookings', bookingId), {
        bookingStatus: 'cancelled',
        updatedAt: Timestamp.now(),
      });

      const updatedBookedSeats = (schedule.bookedSeats || []).filter(
        (seat: string) => !booking.seatNumbers.includes(seat)
      );
      await updateDoc(doc(db, 'schedules', booking.scheduleId), {
        availableSeats: schedule.availableSeats + booking.seatNumbers.length,
        bookedSeats: updatedBookedSeats,
        updatedAt: Timestamp.now(),
      });

      setBookings(prev =>
        prev.map(b => (b.id === bookingId ? { ...b, bookingStatus: 'cancelled' } : b))
      );
      setCancelModal({ open: false, bookingId: '' });
    } catch (err: any) {
      setError(`Failed to cancel booking: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadTicket = async (booking: BookingWithDetails, includeQR: boolean) => {
    try {
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
      booking.passengerDetails.forEach((pd, index) => {
        pdf.text(`Seat ${pd.seatNumber}: ${pd.name} (${pd.age}, ${pd.gender})`, 20, 190 + index * 10);
      });
      pdf.text(`Total: MWK ${booking.totalAmount.toLocaleString()}`, 20, 190 + booking.passengerDetails.length * 10);
      pdf.text(`Status: ${booking.bookingStatus} (${booking.paymentStatus})`, 20, 200 + booking.passengerDetails.length * 10);

      if (includeQR) {
        const qrData = `https://yourapp.com/verify?bookingId=${booking.id}&seats=${booking.seatNumbers.join(',')}&expires=${Date.now() + 4 * 60 * 60 * 1000}`;
        const qrCodeDataUrl = await QRCode.toDataURL(qrData, { width: 100 });
        pdf.addImage(qrCodeDataUrl, 'PNG', 150, 20, 40, 40);
      }

      pdf.save(`ticket-${booking.id.slice(-8).toUpperCase()}${includeQR ? '-qr' : ''}.pdf`);
    } catch (err: any) {
      setError(`Failed to generate ticket: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <AlertMessage type="error" message={error || 'Profile not found'} onClose={() => router.push('/')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Your Profile</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <User className="w-5 h-5 text-black mr-2" /> Profile Details
            </h2>
            {editProfile ? (
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="+265999123456"
                    required
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditProfile(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>Name:</strong> {profile.firstName} {profile.lastName}</p>
                <p><strong>Email:</strong> {profile.email}</p>
                <p><strong>Phone:</strong> {profile.phone}</p>
                <p><strong>Role:</strong> {profile.role}</p>
                <button
                  onClick={() => setEditProfile(true)}
                  className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>

          {/* Bookings Section */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <BusIcon className="w-5 h-5 text-black mr-2" /> Your Bookings
            </h2>
            {bookings.length === 0 ? (
              <div className="text-center py-12">
                <BusIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-lg text-gray-600">No bookings found. Book a bus now!</p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Find Buses
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map(booking => (
                  <article
                    key={booking.id}
                    className="group bg-gray-50 rounded-lg p-4 hover:shadow-lg transition-all duration-300 border border-gray-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2 text-sm text-gray-600">
                        <p className="font-medium text-gray-800">Booking ID: {booking.id.slice(-8).toUpperCase()}</p>
                        <div className="flex items-center space-x-2">
                          <Map className="w-5 h-5 text-red-600" />
                          <p>
                            {booking.route.origin} to {booking.route.destination}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-5 h-5 text-green-600" />
                          <p>
                            {new Date(booking.schedule.departureTime).toLocaleString('en-GB', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Currency className="w-5 h-5 text-red-600" />
                          <p>Total: MWK {booking.totalAmount.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Armchair className="w-5 h-5 text-black" />
                          <p>Seats: {booking.seatNumbers.join(', ')}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <BusIcon className="w-5 h-5 text-black" />
                          <p>
                            {booking.company.name} - {booking.bus.busType} ({booking.bus.busNumber})
                          </p>
                        </div>
                        <p>
                          <strong>Status:</strong>{' '}
                          <span
                            className={`${
                              booking.bookingStatus === 'confirmed' ? 'text-green-600' :
                              booking.bookingStatus === 'cancelled' ? 'text-red-600' :
                              'text-yellow-600'
                            } font-medium`}
                          >
                            {booking.bookingStatus} ({booking.paymentStatus})
                          </span>
                        </p>
                      </div>
                      <div className="mt-4 sm:mt-0 flex space-x-2">
                        <button
                          onClick={() => handleDownloadTicket(booking, false)}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center"
                          disabled={booking.bookingStatus !== 'confirmed'}
                        >
                          <Download className="w-4 h-4 mr-1" /> PDF
                        </button>
                        <button
                          onClick={() => handleDownloadTicket(booking, true)}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center"
                          disabled={booking.bookingStatus !== 'confirmed'}
                        >
                          <QrCode className="w-4 h-4 mr-1" /> QR
                        </button>
                        <button
                          onClick={() => setCancelModal({ open: true, bookingId: booking.id })}
                          className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center"
                          disabled={booking.bookingStatus === 'cancelled' || actionLoading}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Cancel
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <Modal
          isOpen={cancelModal.open}
          onClose={() => setCancelModal({ open: false, bookingId: '' })}
          title="Confirm Cancellation"
        >
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to cancel this booking? This action cannot be undone.
          </p>
          {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
          <div className="flex space-x-2">
            <button
              onClick={() => handleCancelBooking(cancelModal.bookingId)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'Confirm'}
            </button>
            <button
              onClick={() => setCancelModal({ open: false, bookingId: '' })}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ProfilePage;