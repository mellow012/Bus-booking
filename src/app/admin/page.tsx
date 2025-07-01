
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Company, Schedule, Route, Bus, Booking } from '@/types';
import { Building2, Loader2 } from 'lucide-react';
import AlertMessage from '../../components/alertMessage';
import TabButton from '../../components/tabButton';
import CompanyProfileTab from '../../components/company-Profile';
import SchedulesTab from '../../components/scheduleTab';
import RoutesTab from '../../components/routesTab';
import BusesTab from '../../components/busesTab';
import BookingsTab from '../../components/bookingTab';
import StatCard from '../../components/startCard';

export default function AdminDashboard() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [company, setCompany] = useState<Company | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      console.log('Redirecting to /login: No user');
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !userProfile) return;
    if (userProfile.role !== 'company_admin') {
      console.log('Redirecting to /: Not company_admin');
      router.push('/');
    } else if (!userProfile.companyId) {
      console.log('Redirecting to /create-company: No companyId');
      router.push('/create-company');
    } else {
      fetchAdminData(userProfile.companyId);
    }
  }, [userProfile, authLoading, router]);

  const fetchAdminData = async (companyId: string) => {
    setLoading(true);
    try {
      const companyDocRef = doc(db, 'companies', companyId);
      const companySnap = await getDoc(companyDocRef);
      if (!companySnap.exists()) {
        setError('Company not found. Please create a company.');
        router.push('/create-company');
        return;
      }
      setCompany({ id: companySnap.id, ...companySnap.data() } as Company);

      const fetchCollection = async <T>(collectionName: string): Promise<T[]> => {
        const q = query(collection(db, collectionName), where('companyId', '==', companyId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      };

      const [schedulesData, routesData, busesData, bookingsData] = await Promise.all([
        fetchCollection<Schedule>('schedules'),
        fetchCollection<Route>('routes'),
        fetchCollection<Bus>('buses'),
        fetchCollection<Booking>('bookings'),
      ]);

      setSchedules(schedulesData);
      setRoutes(routesData);
      setBuses(busesData);
      setBookings(bookingsData);
    } catch (err: any) {
      setError(`Failed to load dashboard data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {company?.logo ? (
              <img src={company.logo} alt={`${company.name} logo`} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <Building2 className="w-10 h-10 text-white bg-blue-600 rounded-lg p-2" />
            )}
            <div>
              <h1 className="text-xl font-bold">{company?.name || 'Company Dashboard'}</h1>
              <p className="text-sm text-gray-500">Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
              {userProfile?.firstName?.charAt(0).toUpperCase() || 'A'}
            </div>
            <span>{userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Admin'}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
        {success && <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />}

        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-xl shadow-sm">
          <TabButton id="overview" label="Overview" icon="BarChart3" isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton id="schedules" label="Schedules" icon="Calendar" isActive={activeTab === 'schedules'} onClick={() => setActiveTab('schedules')} />
          <TabButton id="routes" label="Routes" icon="MapPin" isActive={activeTab === 'routes'} onClick={() => setActiveTab('routes')} />
          <TabButton id="buses" label="Buses" icon="Truck" isActive={activeTab === 'buses'} onClick={() => setActiveTab('buses')} />
          <TabButton id="bookings" label="Bookings" icon="Users" isActive={activeTab === 'bookings'} onClick={() => setActiveTab('bookings')} />
          <TabButton id="profile" label="Company Profile" icon="Building2" isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon="DollarSign" title="Total Revenue" value={`MWK ${bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0).toLocaleString('en-MW')}`} color="green" />
              <StatCard icon="Users" title="Total Bookings" value={bookings.length} color="blue" />
              <StatCard icon="Calendar" title="Active Schedules" value={schedules.filter(s => s.isActive).length} color="purple" />
              <StatCard icon="Truck" title="Fleet Size" value={buses.length} color="orange" />
            </div>
          </div>
        )}

        {activeTab === 'schedules' && (
          <SchedulesTab
            schedules={schedules}
            setSchedules={setSchedules}
            routes={routes}
            buses={buses}
            companyId={userProfile?.companyId || ''}
            setError={setError}
            setSuccess={setSuccess}
          />
        )}

        {activeTab === 'routes' && (
          <RoutesTab
            routes={routes}
            setRoutes={setRoutes}
            companyId={userProfile?.companyId || ''}
            setError={setError}
            setSuccess={setSuccess}
          />
        )}

        {activeTab === 'buses' && (
          <BusesTab
            buses={buses}
            setBuses={setBuses}
            companyId={userProfile?.companyId || ''}
            setError={setError}
            setSuccess={setSuccess}
          />
        )}

        {activeTab === 'bookings' && (
          <BookingsTab
            bookings={bookings}
            setBookings={setBookings}
            schedules={schedules}
            routes={routes}
            companyId={userProfile?.companyId || ''}
            setError={setError}
            setSuccess={setSuccess}
          />
        )}

        {activeTab === 'profile' && (
          <CompanyProfileTab
            company={company}
            setCompany={setCompany}
            setError={setError}
            setSuccess={setSuccess}
          />
        )}
      </main>
    </div>
  );
}
