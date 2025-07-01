
import { FC } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: string;
  title: string;
  value: string | number;
  color?: string;
}

const StatCard: FC<StatCardProps> = ({ icon, title, value, color = 'blue' }) => {
  const Icon = require('lucide-react')[icon] as LucideIcon;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg bg-${color}-50`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
