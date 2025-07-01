
export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  description: string;
  logo?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  paymentService?: string; // e.g., "PayChangu"
  transactionId?: string; // Mock transaction ID for payment
}

export interface Bus {
  id: string;
  companyId: string;
  busNumber: string;
  busType: 'AC' | 'Non-AC' | 'Sleeper' | 'Semi-Sleeper';
  totalSeats: number;
  amenities: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Route {
  id: string;
  companyId: string;
  origin: string;
  destination: string;
  distance: number;
  duration: number; // in minutes
  stops: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Schedule {
  id: string;
  companyId: string;
  busId: string;
  routeId: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  price: number;
  availableSeats: number;
  bookedSeats: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  userId: string;
  scheduleId: string;
  companyId: string;
  passengerDetails: PassengerDetail[];
  seatNumbers: string[];
  totalAmount: number;
  bookingStatus: 'confirmed' | 'cancelled' | 'pending';
  paymentStatus: 'paid' | 'pending' | 'failed';
  paymentId?: string;
  paymentService?: string; // e.g., "PayChangu"
  transactionId?: string; // Mock transaction ID
  bookingDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PassengerDetail {
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  seatNumber: string;
}

export interface SearchFilterss {
  busType?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  departureTime?: {
    start: string;
    end: string;
  };
  amenities?: string[];
  company?: string;
}

export interface SearchResult {
  schedule: Schedule;
  bus: Bus;
  route: Route;
  company: Company;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'customer' | 'company_admin';
  companyId?: string;
  createdAt: Date;
  updatedAt: Date;
}
