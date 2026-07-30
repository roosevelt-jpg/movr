import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowLeft } from 'lucide-react';

const CartPage: React.FC = () => {
  const navigate = useNavigate();

  const cartItems = [
    { id: 1, name: 'Bread', price: 500, quantity: 2 },
    { id: 2, name: 'Milk (1L)', price: 800, quantity: 1 },
  ];

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const delivery = 500;
  const total = subtotal + delivery;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="card p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Shopping Cart</h1>

        {cartItems.length > 0 ? (
          <>
            <div className="space-y-4 mb-6">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-600">₦{item.price} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="bg-gray-200 p-1 rounded hover:bg-gray-300 transition-colors">
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <button className="bg-gray-200 p-1 rounded hover:bg-gray-300 transition-colors">
                      <Plus size={16} />
                    </button>
                    <button className="ml-4 text-red-600 hover:text-red-700">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-semibold">₦{subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Delivery</span>
                <span className="font-semibold">₦{delivery}</span>
              </div>
              <div className="border-t border-gray-300 pt-2 flex justify-between">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-lg text-green-600">₦{total}</span>
              </div>
            </div>

            <button className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
              Checkout
            </button>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Your cart is empty</p>
            <button
              onClick={() => navigate('/marketplace')}
              className="text-green-600 hover:text-green-700 font-semibold"
            >
              Continue Shopping →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
