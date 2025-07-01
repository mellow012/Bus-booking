
import { FC, useState } from 'react';
import { Schedule, Booking, Route } from '@/types';
import { Search } from 'lucide-react';

interface BookingsTabProps {
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  schedules: Schedule[];
  routes: Route[];
  companyId: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setSuccess: React.Dispatch<React.SetStateAction<string>>;
}

const BookingsTab: FC<BookingsTabProps> = ({ bookings, schedules, routes, setError, setSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBookings = bookings.filter(b => {
    const searchLower = searchTerm.toLowerCase();
    return (
      b.passengerDetails.some(p => p.name.toLowerCase().includes(searchLower)) ||
      b.id.toLowerCase().includes(searchLower) ||
      b.seatNumbers.join(',').toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Bookings</h2>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="mb-4 flex items-center space-x-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Booking ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seats</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBookings.map(booking => {
                const schedule = schedules.find(s => s.id === booking.scheduleId);
                const route = routes.find(r => r.id === schedule?.routeId);
                return (
                  <tr key={booking.id}>
                    <td className="px-6 py-4">{booking.id}</td>
                    <td className="px-6 py-4">{booking.passengerDetails[0]?.name}</td>
                    <td className="px-6 py-4">{route ? `${route.origin} → ${route.destination}` : 'Unknown'}</td>
                    <td className="px-6 py-4">{booking.seatNumbers.join(', ')}</td>
                    <td className="px-6 py-4">MWK {booking.totalAmount.toLocaleString('en-MW')}</td>
                    <td className="px-6 py-4">{booking.bookingStatus} ({booking.paymentStatus})</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BookingsTab;
