
import { FC, useState, ChangeEvent } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Company } from '@/types';
import { Building2, Mail, Phone, MapPin, FileText, Edit3, Save, UploadCloud, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyProfileTabProps {
  company: Company | null;
  setCompany: React.Dispatch<React.SetStateAction<Company | null>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setSuccess: React.Dispatch<React.SetStateAction<string>>;
}

const CompanyProfileTab: FC<CompanyProfileTabProps> = ({ company, setCompany, setError, setSuccess }) => {
  const { user, userProfile } = useAuth();
  const [editData, setEditData] = useState<Company | null>(company);
  const [logoPreview, setLogoPreview] = useState<string | null>(company?.logo || null);
  const [actionLoading, setActionLoading] = useState(false);

  const isValidPhone = (phone: string): boolean => {
    const phoneRegex = /^\+265[0-9]{9}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setError('Please upload a valid image (JPEG or PNG)');
        return;
      }
      if (file.size > 1 * 1024 * 1024) {
        setError('Image size must be less than 1MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        setEditData(prev => (prev ? { ...prev, logo: base64String } : prev));
      };
      reader.onerror = () => setError('Failed to read image file');
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData || !user || !userProfile) {
      setError('User authentication required');
      return;
    }
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!editData.name.trim()) throw new Error('Company name is required');
      if (!editData.email.trim() || !editData.email.includes('@')) throw new Error('Valid email is required');
      if (!editData.phone.trim() || !isValidPhone(editData.phone)) throw new Error('Phone number must be in +265 format (e.g., +265123456789)');
      if (!editData.address.trim()) throw new Error('Address is required');

      console.log('Updating company:', editData.id, 'for user:', user.uid, 'with companyId:', userProfile.companyId);

      const companyRef = doc(db, 'companies', editData.id);
      const updatedData = { ...editData, updatedAt: new Date() };
      await updateDoc(companyRef, updatedData);
      setCompany(updatedData);
      setEditData(null);
      setSuccess('Company profile updated successfully!');
    } catch (err: any) {
      console.error('Update error:', err);
      setError(`Failed to update profile: ${err.message || 'Insufficient permissions or network error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!company) {
    return (
      <div className="text-center text-gray-600 py-8">
        <p>No company data available.</p>
      </div>
    );
  }

  if (!editData) {
    return (
      <div className="bg-gray-50 rounded-xl shadow-sm p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <img
              src={company.logo || 'https://placehold.co/100x100/e2e8f0/64748b?text=Logo'}
              alt={`${company.name} Logo`}
              className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-sm"
            />
            <h2 className="text-2xl font-bold text-gray-800">{company.name}</h2>
          </div>
          <button
            onClick={() => setEditData(company)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Edit3 size={16} />
            <span>Edit Profile</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 flex items-start space-x-3 hover:shadow-lg transition">
            <Building2 className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-600">Company Name</h3>
              <p className="text-lg font-semibold text-gray-800">{company.name}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 flex items-start space-x-3 hover:shadow-lg transition">
            <Mail className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-600">Email</h3>
              <p className="text-lg font-semibold text-gray-800">{company.email}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 flex items-start space-x-3 hover:shadow-lg transition">
            <Phone className="w-6 h-6 text-black" />
            <div>
              <h3 className="text-sm font-medium text-gray-600">Phone</h3>
              <p className="text-lg font-semibold text-gray-800">{company.phone}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 flex items-start space-x-3 hover:shadow-lg transition">
            <MapPin className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-600">Address</h3>
              <p className="text-lg font-semibold text-gray-800">{company.address}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 flex items-start space-x-3 hover:shadow-lg transition md:col-span-2 lg:col-span-1">
            <FileText className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="text-sm font-medium text-gray-600">Description</h3>
              <p className="text-lg text-gray-800">{company.description || 'No description provided'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleUpdate} className="bg-gray-50 rounded-xl shadow-sm p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <img
            src={logoPreview || 'https://placehold.co/100x100/e2e8f0/64748b?text=Logo'}
            alt="Logo Preview"
            className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-sm"
          />
          <h2 className="text-2xl font-bold text-gray-800">Edit {company.name}</h2>
        </div>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={() => {
              setEditData(null);
              setLogoPreview(company.logo || null);
            }}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={actionLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center hover:bg-green-700 transition disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
            Save Changes
          </button>
        </div>
      </div>
      <div className="relative mb-6">
        <label htmlFor="logoUpload" className="absolute -top-3 -right-3 bg-red-600 text-white p-2 rounded-full cursor-pointer hover:bg-red-700 transition">
          <UploadCloud size={16} />
          <input
            type="file"
            id="logoUpload"
            className="hidden"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
          />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <Building2 className="w-5 h-5 text-red-600" />
            <span>Company Name</span>
          </label>
          <input
            value={editData.name}
            onChange={e => setEditData({ ...editData, name: e.target.value })}
            className="mt-2 w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
          />
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <Mail className="w-5 h-5 text-green-600" />
            <span>Email</span>
          </label>
          <input
            type="email"
            value={editData.email}
            onChange={e => setEditData({ ...editData, email: e.target.value })}
            className="mt-2 w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
          />
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <Phone className="w-5 h-5 text-black" />
            <span>Phone (+265)</span>
          </label>
          <input
            type="tel"
            value={editData.phone}
            onChange={e => setEditData({ ...editData, phone: e.target.value })}
            className="mt-2 w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
            pattern="\+265[0-9]{9}"
            title="Phone number must start with +265 followed by 9 digits"
          />
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <MapPin className="w-5 h-5 text-red-600" />
            <span>Address</span>
          </label>
          <input
            value={editData.address}
            onChange={e => setEditData({ ...editData, address: e.target.value })}
            className="mt-2 w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
          />
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 md:col-span-2">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
            <FileText className="w-5 h-5 text-green-600" />
            <span>Description</span>
          </label>
          <textarea
            value={editData.description}
            onChange={e => setEditData({ ...editData, description: e.target.value })}
            className="mt-2 w-full p-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            rows={4}
          />
        </div>
      </div>
    </form>
  );
};

export default CompanyProfileTab;
