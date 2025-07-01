'use client';
import React, { useState, useEffect } from 'react';
import { Bus, Schedule } from '@/types';

interface SeatSelectionProps {
  bus: Bus;
  schedule: Schedule;
  passengers: number;
  onSeatSelection: (seats: string[]) => void;
}

export default function SeatSelection({ bus, schedule, passengers, onSeatSelection }: SeatSelectionProps) {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Generate seat layout (e.g., 40 seats in 10 rows, 4 columns)
  const totalSeats = bus.totalSeats || 40;
  const rows = Math.ceil(totalSeats / 4);
  const seatLayout = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      const seatNumber = `${row + 1}${String.fromCharCode(65 + col)}`;
      return seatNumber;
    })
  );

  const bookedSeats = schedule.bookedSeats || [];

  const handleSeatClick = (seat: string) => {
    if (bookedSeats.includes(seat)) return;

    setSelectedSeats((prev) => {
      if (prev.includes(seat)) {
        return prev.filter(s => s !== seat);
      } else if (prev.length < passengers) {
        return [...prev, seat];
      } else {
        setError(`You can only select ${passengers} seat${passengers > 1 ? 's' : ''}`);
        return prev;
      }
    });
    setError('');
  };

  useEffect(() => {
    if (selectedSeats.length === passengers) {
      onSeatSelection(selectedSeats);
    }
  }, [selectedSeats, passengers, onSeatSelection]);

  return (
    <section className="bg-white rounded-lg shadow-md p-6" aria-label="Seat Selection">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Select {passengers} Seat{passengers > 1 ? 's' : ''}</h2>
      {error && <p className="text-red-500 mb-4" role="alert">{error}</p>}
      
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        {seatLayout.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {row.map((seat, colIndex) => (
              <React.Fragment key={seat}>
                <button
                  className={`p-2 rounded-md text-center text-sm font-medium
                    ${bookedSeats.includes(seat) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' :
                      selectedSeats.includes(seat) ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                  onClick={() => handleSeatClick(seat)}
                  disabled={bookedSeats.includes(seat)}
                  aria-label={`Seat ${seat} ${bookedSeats.includes(seat) ? 'booked' : selectedSeats.includes(seat) ? 'selected' : 'available'}`}
                  aria-pressed={selectedSeats.includes(seat)}
                >
                  {seat}
                </button>
                {colIndex === 1 && <div className="h-2" aria-hidden="true"></div>} {/* Aisle after 2nd column */}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-4 flex items-center space-x-4">
        <div className="flex items-center">
          <span className="w-4 h-4 bg-blue-100 rounded-md mr-2"></span>
          <span className="text-sm text-gray-600">Available</span>
        </div>
        <div className="flex items-center">
          <span className="w-4 h-4 bg-blue-600 rounded-md mr-2"></span>
          <span className="text-sm text-gray-600">Selected</span>
        </div>
        <div className="flex items-center">
          <span className="w-4 h-4 bg-gray-300 rounded-md mr-2"></span>
          <span className="text-sm text-gray-600">Booked</span>
        </div>
      </div>
    </section>
  );
}