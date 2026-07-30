import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, Heart, ShoppingCart } from 'lucide-react';

const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All' },
    { id: 'food', name: '🍕 Food & Drinks' },
    { id: 'grocery', name: '🛒 Groceries' },
    { id: 'fashion', name: '👕 Fashion' },
    { id: 'electronics', name: '📱 Electronics' },
  ];

  const stores = [
    { id: 1, name: 'Foodco Supermarket', category: 'grocery', rating: 4.8, reviews: 245, distance: '0.5 km', image: '🏪' },
    { id: 2, name: 'Pizza Palace', category: 'food', rating: 4.6, reviews: 512, distance: '1.2 km', image: '🍕' },
    { id: 3, name: 'Tech Hub', category: 'electronics', rating: 4.9, reviews: 189, distance: '2 km', image: '📱' },
    { id: 4, name: 'Fashion Boutique', category: 'fashion', rating: 4.7, reviews: 324, distance: '1.8 km', image: '👔' },
    { id: 5, name: 'Fresh Juices', category: 'food', rating: 4.5, reviews: 156, distance: '0.8 km', image: '🥤' },
    { id: 6, name: 'Shoe Store Plus', category: 'fashion', rating: 4.4, reviews: 278, distance: '2.3 km', image: '👞' },
  ];

  const filteredStores = selectedCategory === 'all' 
    ? stores 
    : stores.filter(s => s.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">Marketplace</h1>
        <p className="text-green-100">Shop from thousands of stores and merchants</p>
      </div>

      {/* Search Bar */}
      <div className="card p-6">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-3 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stores or products..."
            className="input-base pl-12 text-lg"
          />
        </div>

        {/* Categories */}
        <div className="flex overflow-x-auto gap-2 pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStores.map((store) => (
          <div
            key={store.id}
            className="card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate(`/store/${store.id}`)}
          >
            <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-6xl">
              {store.image}
            </div>
            <div className="p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{store.name}</h3>
              <div className="flex items-center gap-2 mb-3">
                <Star className="text-yellow-400 fill-yellow-400" size={16} />
                <span className="font-semibold text-gray-900">{store.rating}</span>
                <span className="text-gray-600">({store.reviews})</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600 mb-4">
                <MapPin size={16} />
                <span className="text-sm">{store.distance}</span>
              </div>
              <button className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                View Store
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketplacePage;
