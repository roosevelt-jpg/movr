import React, { useState } from 'react';
import { Calendar, MapPin, DollarSign, Star } from 'lucide-react';

const HistoryPage: React.FC = () => {
  const [filterType, setFilterType] = useState('all');

  const items = [
    { id: 1, type: 'ride', title: 'Ride to Airport', from: 'Lekki', to: 'Murtala Airport', amount: -2500, date: '2024-01-15', rating: 5 },
    { id: 2, type: 'purchase', title: 'Foodco Supermarket', items: 'Groceries (5)', amount: -3200, date: '2024-01-15' },
    { id: 3, type: 'ride', title: 'Ride from Work', from: 'VI', to: 'Lekki', amount: -1800, date: '2024-01-14', rating: 5 },
    { id: 4, type: 'reward', title: 'Referral Bonus', description: 'Friend signed up', amount: 500, date: '2024-01-14' },
  ];

  const filtered = filterType === 'all' ? items : items.filter(i => i.type === filterType);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">History</h1>
        <p className="text-purple-100">Your rides, purchases, and transactions</p>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="flex flex-wrap gap-3">
          {['all', 'ride', 'purchase', 'reward'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-full capitalize transition-all ${
                filterType === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {type === 'all' && 'All'}
              {type === 'ride' && '🚗 Rides'}
              {type === 'purchase' && '🛒 Purchases'}
              {type === 'reward' && '🎁 Rewards'}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <div key={item.id} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                {'from' in item && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <MapPin size={16} />
                    <span>{item.from} → {item.to}</span>
                  </div>
                )}
                {'items' in item && (
                  <p className="text-sm text-gray-600 mt-1">{item.items}</p>
                )}
                {'description' in item && (
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">{item.date}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold text-lg ${item.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {item.amount > 0 ? '+' : ''}₦{Math.abs(item.amount)}
                </p>
                {'rating' in item && (
                  <div className="flex items-center gap-1 mt-2 justify-end">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryPage;
