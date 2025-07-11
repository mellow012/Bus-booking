
import { FC } from 'react';
import { LucideIcon } from 'lucide-react';

interface TabButtonProps {
  id: string;
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: FC<TabButtonProps> = ({ id, label, icon, isActive, onClick }) => {
  const Icon = require('lucide-react')[icon] as LucideIcon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
};

export default TabButton;
