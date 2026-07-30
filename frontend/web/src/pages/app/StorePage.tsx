import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, ArrowLeft, ShoppingCart, Plus, Minus } from 'lucide-react';

const StorePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const products = [
    { id: 1, name: 'Bread', price: 500, rating: 5 },
    { id: 2, name: 'Milk (1L)', price: 800, rating: 4.8 },
    { id: 3, name: 'Eggs (Dozen)', price: 1200, rating: 5 },
  ];

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="card">
        <div className="h-40 bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-6xl">
          🏪
        </div>
        <div className="p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Foodco Supermarket</h1>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1">
              <Star className="text-yellow-400 fill-yellow-400" size={20} />
              <span className="font-semibold text-gray-900">4.8</span>
              <span className="text-gray-600">(245 reviews)</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <MapPin size={16} />
              <span>0.5 km away</span>
            </div>
          </div>
          <p className="text-gray-600">Open 8:00 AM - 10:00 PM</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Popular Products</h2>
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-semibold text-gray-900">{product.name}</p>
                <p className="text-sm text-gray-600">★ {product.rating}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">₦{product.price}</p>
                <button className="mt-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors flex items-center gap-1 ml-auto">
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => navigate('/cart')}
        className="fixed bottom-6 right-6 bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition-colors"
      >
        <ShoppingCart size={24} />
      </button>
    </div>
  );
};

export default StorePage;
