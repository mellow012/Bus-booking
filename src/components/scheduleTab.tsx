
import { FC, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Schedule, Route, Bus } from '@/types';
import Modal from './Modals';
import { Plus, Edit3, Trash2, Search } from 'lucide-react';

interface SchedulesTabProps {
  schedules: Schedule[];
  setSchedules: React.Dispatch<React.SetStateAction<Schedule[]>>;
  routes: Route[];
  buses: Bus[];
  companyId: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setSuccess: React.Dispatch<React.SetStateAction<string>>;
}

const SchedulesTab: FC<SchedulesTabProps> = ({ schedules, setSchedules, routes, buses, companyId, setError, setSuccess }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const initialNewSchedule = {
    routeId: '',
    busId: '',
    companyId,
    departureTime: '',
    arrivalTime: '',
    date: '',
    price: 0,
    availableSeats: 0,
    bookedSeats: [],
    isActive: true,
  };
  const [newSchedule, setNewSchedule] = useState(initialNewSchedule);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.routeId || !newSchedule.busId || !newSchedule.date) {
      setError('Please fill all required fields');
      return;
    }
    const bus = buses.find(b => b.id === newSchedule.busId);
    if (!bus || newSchedule.availableSeats > bus.totalSeats) {
      setError(`Available seats cannot exceed bus capacity (${bus?.totalSeats || 0})`);
      return;
    }
    setActionLoading(true);
    try {
      const docData = { ...newSchedule, createdAt: new Date(), updatedAt: new Date() };
      const docRef = await addDoc(collection(db, 'schedules'), docData);
      setSchedules([{ id: docRef.id, ...docData }, ...schedules]);
      setNewSchedule(initialNewSchedule);
      setShowAddModal(false);
      setSuccess('Schedule added successfully!');
    } catch (err: any) {
      setError(`Failed to add schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSchedule) return;
    const bus = buses.find(b => b.id === editSchedule.busId);
    if (!bus || editSchedule.availableSeats > bus.totalSeats) {
      setError(`Available seats cannot exceed bus capacity (${bus?.totalSeats || 0})`);
      return;
    }
    setActionLoading(true);
    try {
      const docRef = doc(db, 'schedules', editSchedule.id);
      const updatedData = { ...editSchedule, updatedAt: new Date() };
      await updateDoc(docRef, updatedData);
      setSchedules(schedules.map(s => s.id === editSchedule.id ? updatedData : s));
      setShowEditModal(false);
      setEditSchedule(null);
      setSuccess('Schedule updated successfully!');
    } catch (err: any) {
      setError(`Failed to update schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'schedules', id));
      setSchedules(schedules.filter(s => s.id !== id));
      setSuccess('Schedule deleted successfully!');
    } catch (err: any) {
      setError(`Failed to delete schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSchedules = schedules.filter(s => {
    const route = routes.find(r => r.id === s.routeId);
    const bus = buses.find(b => b.id === s.busId);
    const searchLower = searchTerm.toLowerCase();
    return (
      route?.origin.toLowerCase().includes(searchLower) ||
      route?.destination.toLowerCase().includes(searchLower) ||
      bus?.busNumber.toLowerCase().includes(searchLower) ||
      s.date.includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Schedules</h2>
        <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /><span>Add Schedule</span>
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="mb-4 flex items-center space-x-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search schedules..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bus</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seats</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSchedules.map(schedule => (
                <tr key={schedule.id}>
                  <td className="px-6 py-4">{routes.find(r => r.id === schedule.routeId)?.origin} → {routes.find(r => r.id === schedule.routeId)?.destination}</td>
                  <td className="px-6 py-4">{buses.find(b => b.id === schedule.busId)?.busNumber} ({buses.find(b => b.id === schedule.busId)?.busType})</td>
                  <td className="px-6 py-4">{schedule.date} {schedule.departureTime}</td>
                  <td className="px-6 py-4">MWK {schedule.price.toLocaleString('en-MW')}</td>
                  <td className="px-6 py-4">{schedule.availableSeats}/{buses.find(b => b.id === schedule.busId)?.totalSeats}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => { setEditSchedule(schedule); setShowEditModal(true); }} className="text-blue-600 mr-2">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(schedule.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Schedule">
        <form onSubmit={handleAdd} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Route</label>
            <select
              value={newSchedule.routeId}
              onChange={e => setNewSchedule({ ...newSchedule, routeId: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">Select Route</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bus</label>
            <select
              value={newSchedule.busId}
              onChange={e => {
                const bus = buses.find(b => b.id === e.target.value);
                setNewSchedule({ ...newSchedule, busId: e.target.value, availableSeats: bus?.totalSeats || 0 });
              }}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">Select Bus</option>
              {buses.map(b => (
                <option key={b.id} value={b.id}>{b.busNumber} ({b.busType})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Departure Time</label>
            <input
              type="time"
              value={newSchedule.departureTime}
              onChange={e => setNewSchedule({ ...newSchedule, departureTime: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Arrival Time</label>
            <input
              type="time"
              value={newSchedule.arrivalTime}
              onChange={e => setNewSchedule({ ...newSchedule, arrivalTime: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={newSchedule.date}
              onChange={e => setNewSchedule({ ...newSchedule, date: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Price (MWK)</label>
            <input
              type="number"
              value={newSchedule.price}
              onChange={e => setNewSchedule({ ...newSchedule, price: parseFloat(e.target.value) || 0 })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Available Seats</label>
            <input
              type="number"
              value={newSchedule.availableSeats}
              onChange={e => setNewSchedule({ ...newSchedule, availableSeats: parseInt(e.target.value) || 0 })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
              min="0"
            />
          </div>
          <div className="flex justify-end space-x-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
              {actionLoading ? 'Adding...' : 'Add Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Schedule">
        {editSchedule && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Route</label>
              <select
                value={editSchedule.routeId}
                onChange={e => setEditSchedule({ ...editSchedule, routeId: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="">Select Route</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bus</label>
              <select
                value={editSchedule.busId}
                onChange={e => {
                  const bus = buses.find(b => b.id === e.target.value);
                  setEditSchedule({ ...editSchedule, busId: e.target.value, availableSeats: bus?.totalSeats || editSchedule.availableSeats });
                }}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="">Select Bus</option>
                {buses.map(b => (
                  <option key={b.id} value={b.id}>{b.busNumber} ({b.busType})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Departure Time</label>
              <input
                type="time"
                value={editSchedule.departureTime}
                onChange={e => setEditSchedule({ ...editSchedule, departureTime: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Arrival Time</label>
              <input
                type="time"
                value={editSchedule.arrivalTime}
                onChange={e => setEditSchedule({ ...editSchedule, arrivalTime: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={editSchedule.date}
                onChange={e => setEditSchedule({ ...editSchedule, date: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Price (MWK)</label>
              <input
                type="number"
                value={editSchedule.price}
                onChange={e => setEditSchedule({ ...editSchedule, price: parseFloat(e.target.value) || 0 })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Available Seats</label>
              <input
                type="number"
                value={editSchedule.availableSeats}
                onChange={e => setEditSchedule({ ...editSchedule, availableSeats: parseInt(e.target.value) || 0 })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
                min="0"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                {actionLoading ? 'Updating...' : 'Update Schedule'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default SchedulesTab;
