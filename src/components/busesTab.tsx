
import { FC, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Bus } from '@/types';
import Modal from './Modals';
import { Plus, Edit3, Trash2, Search } from 'lucide-react';

interface BusesTabProps {
  buses: Bus[];
  setBuses: React.Dispatch<React.SetStateAction<Bus[]>>;
  companyId: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setSuccess: React.Dispatch<React.SetStateAction<string>>;
}

const BusesTab: FC<BusesTabProps> = ({ buses, setBuses, companyId, setError, setSuccess }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBus, setEditBus] = useState<Bus | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const initialNewBus = { busNumber: '', busType: 'AC' as 'AC', totalSeats: 0, amenities: [], companyId, isActive: true };
  const [newBus, setNewBus] = useState(initialNewBus);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBus.busNumber || newBus.totalSeats <= 0) {
      setError('Please fill all required fields with valid data');
      return;
    }
    setActionLoading(true);
    try {
      const docData = { ...newBus, createdAt: new Date(), updatedAt: new Date() };
      const docRef = await addDoc(collection(db, 'buses'), docData);
      setBuses([{ id: docRef.id, ...docData }, ...buses]);
      setNewBus(initialNewBus);
      setShowAddModal(false);
      setSuccess('Bus added successfully!');
    } catch (err: any) {
      setError(`Failed to add bus: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBus || editBus.totalSeats <= 0) {
      setError('Please fill all required fields with valid data');
      return;
    }
    setActionLoading(true);
    try {
      const docRef = doc(db, 'buses', editBus.id);
      const updatedData = { ...editBus, updatedAt: new Date() };
      await updateDoc(docRef, updatedData);
      setBuses(buses.map(b => b.id === editBus.id ? updatedData : b));
      setShowEditModal(false);
      setEditBus(null);
      setSuccess('Bus updated successfully!');
    } catch (err: any) {
      setError(`Failed to update bus: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bus?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'buses', id));
      setBuses(buses.filter(b => b.id !== id));
      setSuccess('Bus deleted successfully!');
    } catch (err: any) {
      setError(`Failed to delete bus: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredBuses = buses.filter(b => {
    const searchLower = searchTerm.toLowerCase();
    return (
      b.busNumber.toLowerCase().includes(searchLower) ||
      b.busType.toLowerCase().includes(searchLower) ||
      b.amenities.some(a => a.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Buses</h2>
        <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /><span>Add Bus</span>
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="mb-4 flex items-center space-x-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search buses..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bus Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seats</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amenities</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBuses.map(bus => (
                <tr key={bus.id}>
                  <td className="px-6 py-4">{bus.busNumber}</td>
                  <td className="px-6 py-4">{bus.busType}</td>
                  <td className="px-6 py-4">{bus.totalSeats}</td>
                  <td className="px-6 py-4">{bus.amenities.join(', ') || 'None'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => { setEditBus(bus); setShowEditModal(true); }} className="text-blue-600 mr-2">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(bus.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Bus">
        <form onSubmit={handleAdd} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Bus Number</label>
            <input
              type="text"
              value={newBus.busNumber}
              onChange={e => setNewBus({ ...newBus, busNumber: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bus Type</label>
            <select
              value={newBus.busType}
              onChange={e => setNewBus({ ...newBus, busType: e.target.value as 'AC' | 'Non-AC' | 'Sleeper' | 'Semi-Sleeper' })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="AC">AC</option>
              <option value="Non-AC">Non-AC</option>
              <option value="Sleeper">Sleeper</option>
              <option value="Semi-Sleeper">Semi-Sleeper</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Total Seats</label>
            <input
              type="number"
              value={newBus.totalSeats}
              onChange={e => setNewBus({ ...newBus, totalSeats: parseInt(e.target.value) || 0 })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amenities (comma-separated)</label>
            <input
              type="text"
              value={newBus.amenities.join(',')}
              onChange={e => setNewBus({ ...newBus, amenities: e.target.value.split(',').map(a => a.trim()).filter(a => a) })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex justify-end space-x-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
              {actionLoading ? 'Adding...' : 'Add Bus'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Bus">
        {editBus && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Bus Number</label>
              <input
                type="text"
                value={editBus.busNumber}
                onChange={e => setEditBus({ ...editBus, busNumber: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bus Type</label>
              <select
                value={editBus.busType}
                onChange={e => setEditBus({ ...editBus, busType: e.target.value as 'AC' | 'Non-AC' | 'Sleeper' | 'Semi-Sleeper' })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="AC">AC</option>
                <option value="Non-AC">Non-AC</option>
                <option value="Sleeper">Sleeper</option>
                <option value="Semi-Sleeper">Semi-Sleeper</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total Seats</label>
              <input
                type="number"
                value={editBus.totalSeats}
                onChange={e => setEditBus({ ...editBus, totalSeats: parseInt(e.target.value) || 0 })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amenities (comma-separated)</label>
              <input
                type="text"
                value={editBus.amenities.join(',')}
                onChange={e => setEditBus({ ...editBus, amenities: e.target.value.split(',').map(a => a.trim()).filter(a => a) })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                {actionLoading ? 'Updating...' : 'Update Bus'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default BusesTab;
