// frontend/admin/src/pages/Dashboard.tsx
import React from 'react';
import { useQuery } from 'react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { formatCurrency } from '../lib/currency';

const AdminDashboard: React.FC = () => {
  // Fetch admin dashboard data
  const { data: dashboardData } = useQuery('admin-dashboard', () =>
    api.get('/admin/dashboard')
  );

  const dashboard = dashboardData?.data?.data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to MOVR Management</p>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {dashboard?.totalUsers || '0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <p className="text-sm text-green-600 mt-4">+12% this month</p>
          </div>

          {/* Active Rides */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Active Rides</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {dashboard?.activeRides || '0'}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🚗</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Ongoing rides</p>
          </div>

          {/* GMV */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">GMV (This Month)</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {formatCurrency(Number(dashboard?.monthlyGmv || 0), dashboard?.currency || 'GHS')}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
            </div>
            <p className="text-sm text-green-600 mt-4">+8% vs last month</p>
          </div>

          {/* Avg Rating */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Avg Rating</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {dashboard?.avgRating || '4.5'}⭐
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⭐</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Platform satisfaction</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Revenue Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboard?.revenueData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="var(--electric-violet)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Rides Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Rides by Type</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboard?.ridesData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="var(--electric-violet)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Management Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Users Management */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">User Management</h2>
            <div className="space-y-3">
              <button className="w-full bg-blue-100 text-blue-700 px-4 py-3 rounded-lg hover:bg-blue-200 transition">
                👥 View All Users
              </button>
              <button className="w-full bg-purple-100 text-purple-700 px-4 py-3 rounded-lg hover:bg-purple-200 transition">
                🚗 Manage Drivers
              </button>
              <button className="w-full bg-green-100 text-green-700 px-4 py-3 rounded-lg hover:bg-green-200 transition">
                🏪 Manage Merchants
              </button>
              <button className="w-full bg-red-100 text-red-700 px-4 py-3 rounded-lg hover:bg-red-200 transition">
                🚫 Suspended Users
              </button>
            </div>
          </div>

          {/* CMS Management */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Content Management</h2>
            <div className="space-y-3">
              <button className="w-full bg-indigo-100 text-indigo-700 px-4 py-3 rounded-lg hover:bg-indigo-200 transition">
                📝 Create Blog Post
              </button>
              <button className="w-full bg-cyan-100 text-cyan-700 px-4 py-3 rounded-lg hover:bg-cyan-200 transition">
                🎨 Manage Banners
              </button>
              <button className="w-full bg-teal-100 text-teal-700 px-4 py-3 rounded-lg hover:bg-teal-200 transition">
                📧 Email Campaigns
              </button>
              <button className="w-full bg-orange-100 text-orange-700 px-4 py-3 rounded-lg hover:bg-orange-200 transition">
                ⚙️ System Settings
              </button>
            </div>
          </div>
        </div>

        {/* Payment & Financial */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Financial Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border-l-4 border-green-500 pl-4">
              <p className="text-gray-500 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(Number(dashboard?.totalRevenue || 0), dashboard?.currency || 'GHS')}
              </p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <p className="text-gray-500 text-sm">Driver Payouts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(Number(dashboard?.driverPayouts || 0), dashboard?.currency || 'GHS')}
              </p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-gray-500 text-sm">Pending Payments</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {dashboard?.pendingPayments || '0'}
              </p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4">
              <p className="text-gray-500 text-sm">Transaction Fee</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {dashboard?.transactionFee || '2.5%'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
