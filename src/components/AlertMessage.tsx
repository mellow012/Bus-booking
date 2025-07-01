
import { FC } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface AlertMessageProps {
  type: 'error' | 'success';
  message: string;
  onClose: () => void;
}

const AlertMessage: FC<AlertMessageProps> = ({ type, message, onClose }) => (
  <div className={`mb-6 rounded-lg p-4 ${type === 'error' ? 'bg-red-50' : 'bg-green-50'}`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        {type === 'error' ? (
          <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
        ) : (
          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
        )}
        <span className={`text-sm ${type === 'error' ? 'text-red-800' : 'text-green-800'}`}>{message}</span>
      </div>
      <button onClick={onClose} className={type === 'error' ? 'text-red-600' : 'text-green-600'}>
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

export default AlertMessage;
