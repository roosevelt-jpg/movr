// frontend/public-website/src/pages/Home.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-purple-600">MOVR</div>
          <div className="hidden md:flex space-x-8">
            <a href="#features" className="text-gray-600 hover:text-purple-600">Features</a>
            <a href="#howitworks" className="text-gray-600 hover:text-purple-600">How It Works</a>
            <a href="#pricing" className="text-gray-600 hover:text-purple-600">Pricing</a>
            <a href="#faq" className="text-gray-600 hover:text-purple-600">FAQ</a>
          </div>
          <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700">
            Download App
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-10 md:mb-0">
            <h1 className="text-5xl font-bold mb-6">
              Move Forward with MOVR
            </h1>
            <p className="text-xl text-purple-100 mb-8">
              The all-in-one platform for rides, deliveries, shopping, and more. Made in Africa, for Africa.
            </p>
            <div className="flex gap-4">
              <Link to="/download" className="bg-white text-purple-600 px-8 py-3 rounded-lg font-bold hover:bg-gray-100">
                Get Started
              </Link>
              <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-bold hover:bg-white hover:bg-opacity-10">
                Learn More
              </button>
            </div>
          </div>
          <div className="md:w-1/2 text-center">
            <div className="text-6xl">📱🚗🛒</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Why Choose MOVR?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-5xl mb-4">🚗</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Rides</h3>
              <p className="text-gray-600">
                Quick, safe, and affordable rides at the tap of a button. Real-time tracking and 24/7 support.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-5xl mb-4">🛒</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Shopping</h3>
              <p className="text-gray-600">
                Browse local stores and get groceries delivered to your door. Fast, reliable, and convenient.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-5xl mb-4">💳</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Digital Wallet</h3>
              <p className="text-gray-600">
                Secure, instant payments. Earn rewards points on every transaction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="howitworks" className="py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { num: '1', title: 'Download', desc: 'Get the MOVR app' },
              { num: '2', title: 'Sign Up', desc: 'Create your account' },
              { num: '3', title: 'Request', desc: 'Order a ride or shop' },
              { num: '4', title: 'Enjoy', desc: 'Experience convenience' },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Drivers Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="bg-white rounded-lg shadow-lg p-12 flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-8 md:mb-0">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Earn with MOVR
              </h2>
              <p className="text-xl text-gray-600 mb-6">
                Drivers earn 100% commission! Pay only a monthly subscription. No hidden fees.
              </p>
              <ul className="space-y-3 text-gray-600 mb-8">
                <li>✅ 100% of every fare you earn</li>
                <li>✅ Cancel anytime, no lock-in</li>
                <li>✅ Access to analytics dashboard</li>
                <li>✅ Instant payouts</li>
              </ul>
              <button className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700">
                Become a Driver
              </button>
            </div>
            <div className="md:w-1/2 text-center">
              <div className="text-6xl">💰</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold mb-2">100k+</p>
              <p className="text-purple-100">Users</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">1M+</p>
              <p className="text-purple-100">Rides</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">50k+</p>
              <p className="text-purple-100">Merchants</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">24/7</p>
              <p className="text-purple-100">Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Simple Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Basic', price: 'Free', features: ['Use app', 'Request rides', 'Shop'] },
              { name: 'Driver', price: 'GHS 99/mo', features: ['100% commission', 'Analytics', 'Priority support'] },
              { name: 'Pro', price: 'GHS 499/mo', features: ['Everything in Driver', 'Bonus earnings', 'Exclusive events'] },
            ].map((plan) => (
              <div key={plan.name} className="bg-white rounded-lg shadow-lg p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-3xl font-bold text-purple-600 mb-6">{plan.price}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-gray-600">
                      <span className="text-green-500 mr-3">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700">
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-bold mb-4">About</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Safety</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Cookies</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Follow Us</h4>
              <div className="flex gap-4">
                <a href="#" className="hover:text-white">Facebook</a>
                <a href="#" className="hover:text-white">Twitter</a>
                <a href="#" className="hover:text-white">Instagram</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-8 text-center">
            <p>&copy; 2026 MOVR. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
