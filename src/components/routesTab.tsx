
import { FC, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Route } from '@/types';
import Modal from './Modals';
import { Plus, Edit3, Trash2, Search } from 'lucide-react';

interface RoutesTabProps {
  routes: Route[];
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  companyId: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setSuccess: React.Dispatch<React.SetStateAction<string>>;
}

const RoutesTab: FC<RoutesTabProps> = ({ routes, setRoutes, companyId, setError, setSuccess }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const initialNewRoute = { origin: '', destination: '', distance: 0, duration: 0, stops: [], companyId, isActive: true };
  const [newRoute, setNewRoute] = useState(initialNewRoute);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoute.origin || !newRoute.destination || newRoute.distance <= 0 || newRoute.duration <= 0) {
      setError('Please fill all required fields with valid data');
      return;
    }
    setActionLoading(true);
    try {
      const docData = { ...newRoute, createdAt: new Date(), updatedAt: new Date() };
      const docRef = await addDoc(collection(db, 'routes'), docData);
      setRoutes([{ id: docRef.id, ...docData }, ...routes]);
      setNewRoute(initialNewRoute);
      setShowAddModal(false);
      setSuccess('Route added successfully!');
    } catch (err: any) {
      setError(`Failed to add route: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoute || editRoute.distance <= 0 || editRoute.duration <= 0) {
      setError('Please fill all required fields with valid data');
      return;
    }
    setActionLoading(true);
    try {
      const docRef = doc(db, 'routes', editRoute.id);
      const updatedData = { ...editRoute, updatedAt: new Date() };
      await updateDoc(docRef, updatedData);
      setRoutes(routes.map(r => r.id === editRoute.id ? updatedData : r));
      setShowEditModal(false);
      setEditRoute(null);
      setSuccess('Route updated successfully!');
    } catch (err: any) {
      setError(`Failed to update route: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'routes', id));
      setRoutes(routes.filter(r => r.id !== id));
      setSuccess('Route deleted successfully!');
    } catch (err: any) {
      setError(`Failed to delete route: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRoutes = routes.filter(r => {
    const searchLower = searchTerm.toLowerCase();
    return (
      r.origin.toLowerCase().includes(searchLower) ||
      r.destination.toLowerCase().includes(searchLower) ||
      r.stops.some(s => s.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Routes</h2>
        <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /><span>Add Route</span>
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="mb-4 flex items-center space-x-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search routes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stops</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRoutes.map(route => (
                <tr key={route.id}>
                  <td className="px-6 py-4">{route.origin}</td>
                  <td className="px-6 py-4">{route.destination}</td>
                  <td className="px-6 py-4">{route.distance} km</td>
                  <td className="px-6 py-4">{Math.floor(route.duration / 60)}h {route.duration % 60}m</td>
                  <td className="px-6 py-4">{route.stops.join(', ') || 'None'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => { setEditRoute(route); setShowEditModal(true); }} className="text-blue-600 mr-2">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(route.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Route">
        <form onSubmit={handleAdd} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Origin</label>
            <input
              type="text"
              value={newRoute.origin}
              onChange={e => setNewRoute({ ...newRoute, origin: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Destination</label>
            <input
              type="text"
              value={newRoute.destination}
              onChange={e => setNewRoute({ ...newRoute, destination: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Distance (km)</label>
            <input
              type="number"
              value={newRoute.distance}
              onChange={e => setNewRoute({ ...newRoute, distance: parseFloat(e.target.value) || 0 })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
            <input
              type="number"
              value={newRoute.duration}
              onChange={e => setNewRoute({ ...newRoute, duration: parseInt(e.target.value) || 0 })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Stops (comma-separated)</label>
            <input
              type="text"
              value={newRoute.stops.join(',')}
              onChange={e => setNewRoute({ ...newRoute, stops: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex justify-end space-x-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
              {actionLoading ? 'Adding...' : 'Add Route'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Route">
        {editRoute && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Origin</label>
              <input
                type="text"
                value={editRoute.origin}
                onChange={e => setEditRoute({ ...editRoute, origin: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Destination</label>
              <input
                type="text"
                value={editRoute.destination}
                onChange={e => setEditRoute({ ...editRoute, destination: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Distance (km)</label>
              <input
                type="number"
                value={editRoute.distance}
                onChange={e => setEditRoute({ ...editRoute, distance: parseFloat(e.target.value) || 0 })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
              <input
                type="number"
                value={editRoute.duration}
                onChange={e => setEditRoute({ ...editRoute, duration: parseInt(e.target.value) || 0 })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Stops (comma-separated)</label>
              <input
                type="text"
                value={editRoute.stops.join(',')}
                onChange={e => setEditRoute({ ...editRoute, stops: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                className="mt-1 block w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                {actionLoading ? 'Updating...' : 'Update Route'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default RoutesTab;
