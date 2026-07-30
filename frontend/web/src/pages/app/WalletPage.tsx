import React, { useState } from 'react';
import { CreditCard, TrendingUp, Send, Download, Plus } from 'lucide-react';

const WalletPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('balance');

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">Wallet</h1>
        <p className="text-blue-100">Manage your funds and payment methods</p>
      </div>

      {/* Balance Card */}
      <div className="card p-8 bg-gradient-to-br from-blue-600 to-blue-500 text-white">
        <p className="text-blue-100 mb-2">Wallet Balance</p>
        <p className="text-5xl font-bold mb-8">₦12,450.50</p>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
            <Plus size={20} /> Add Funds
          </button>
          <button className="flex items-center gap-2 border border-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-400 transition-colors">
            <Send size={20} /> Send
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-gray-200">
          {['balance', 'transactions', 'methods'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-4 font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'balance' && 'Account'}
              {tab === 'transactions' && 'Transactions'}
              {tab === 'methods' && 'Payment Methods'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'balance' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div><p className="font-semibold">Loyalty Points</p><p className="text-sm text-gray-600">3,450 points</p></div>
                <button className="text-blue-600 hover:text-blue-700 font-semibold">Redeem</button>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div><p className="font-semibold">Referral Bonus</p><p className="text-sm text-gray-600">₦2,500 available</p></div>
                <button className="text-blue-600 hover:text-blue-700 font-semibold">Withdraw</button>
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Download className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <p className="font-semibold">Ride Payment</p>
                      <p className="text-sm text-gray-600">Today at 2:30 PM</p>
                    </div>
                  </div>
                  <p className="font-bold text-red-600">-₦2,500</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'methods' && (
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg flex items-between justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="text-gray-600" size={28} />
                  <div>
                    <p className="font-semibold">•••• •••• •••• 4242</p>
                    <p className="text-sm text-gray-600">Expires 12/26</p>
                  </div>
                </div>
                <button className="text-red-600 hover:text-red-700 font-semibold">Remove</button>
              </div>
              <button className="w-full border-2 border-dashed border-gray-300 py-4 rounded-lg text-gray-700 hover:border-gray-400 transition-colors font-semibold">
                + Add Payment Method
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
