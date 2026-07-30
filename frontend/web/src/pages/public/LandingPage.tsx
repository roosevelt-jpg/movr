import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, ShoppingCart, Zap, Users, ArrowRight, MapPin, Star, TrendingUp } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black">M</span>
            </div>
            <span className="text-xl font-black text-gray-900">MOVR</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-700 hover:text-gray-900 font-medium">Features</a>
            <a href="#about" className="text-gray-700 hover:text-gray-900 font-medium">About</a>
            <a href="#contact" className="text-gray-700 hover:text-gray-900 font-medium">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="btn-secondary"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="btn-primary"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-orange-50 via-white to-blue-50">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl md:text-6xl font-black text-gray-900 mb-6">
                <span className="gradient-text">Africa's Super-App</span> for Mobility & Commerce
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                One app for rides, shopping, delivery, and earnings. Move faster. Shop smarter. Earn more.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/register')}
                  className="btn-primary px-8 py-4 text-lg font-semibold flex items-center justify-center gap-2"
                >
                  Download Now
                  <ArrowRight size={20} />
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="btn-secondary px-8 py-4 text-lg font-semibold"
                >
                  Sign In
                </button>
              </div>
              <div className="mt-12 space-y-4">
                <div className="flex items-center gap-3">
                  <Star className="text-orange-600" size={24} />
                  <p className="text-gray-700 font-medium">4.8★ Rating on App Stores</p>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="text-orange-600" size={24} />
                  <p className="text-gray-700 font-medium">2M+ Active Users</p>
                </div>
                <div className="flex items-center gap-3">
                  <TrendingUp className="text-orange-600" size={24} />
                  <p className="text-gray-700 font-medium">Growing 50% Month-over-Month</p>
                </div>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="w-80 h-96 bg-gradient-to-br from-orange-400 to-orange-600 rounded-3xl shadow-2xl flex items-center justify-center">
                <div className="text-white text-center">
                  <Zap size={80} className="mx-auto mb-4" />
                  <p className="text-2xl font-bold">The Future of Mobility</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything You Need</h2>
            <p className="text-xl text-gray-600">One app, countless possibilities</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="card p-8 text-center hover:shadow-lg transition-shadow">
              <Car className="w-12 h-12 mx-auto text-orange-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Rides</h3>
              <p className="text-gray-600">Fast, safe, and affordable transportation</p>
            </div>
            <div className="card p-8 text-center hover:shadow-lg transition-shadow">
              <ShoppingCart className="w-12 h-12 mx-auto text-orange-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Shopping</h3>
              <p className="text-gray-600">Thousands of merchants at your fingertips</p>
            </div>
            <div className="card p-8 text-center hover:shadow-lg transition-shadow">
              <MapPin className="w-12 h-12 mx-auto text-orange-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delivery</h3>
              <p className="text-gray-600">Quick delivery from stores to your door</p>
            </div>
            <div className="card p-8 text-center hover:shadow-lg transition-shadow">
              <Zap className="w-12 h-12 mx-auto text-orange-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Rewards</h3>
              <p className="text-gray-600">Earn tokens on every transaction</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-orange-600 to-orange-500">
        <div className="container max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Move Forward?</h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Join millions of users already enjoying MOVR. Download the app or create an account today.
          </p>
          <button
            onClick={() => navigate('/register')}
            className="bg-white text-orange-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
          >
            Get Started Now
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#about" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
                <li><a href="#" className="hover:text-white transition">Press</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms</a></li>
                <li><a href="#" className="hover:text-white transition">Safety</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <p className="text-sm mb-2">support@movr.io</p>
              <p className="text-sm">+1 234 567 8900</p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2024 MOVR. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
