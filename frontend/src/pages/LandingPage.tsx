import { Link } from "react-router";
import {
  ChevronDown,
  Shield,
  Bot,
  TrendingUp,
  BarChart3,
  Lock,
  Zap,
} from "lucide-react";
import { useState } from "react";

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                TradePro
              </span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a
                href="#tutorial"
                className="text-gray-700 hover:text-blue-600 transition"
              >
                Tutorial
              </a>
              <a
                href="#features"
                className="text-gray-700 hover:text-blue-600 transition"
              >
                Features
              </a>
              <a
                href="#faq"
                className="text-gray-700 hover:text-blue-600 transition"
              >
                FAQ
              </a>
            </div>
            <Link
              to="/login"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Automated Trading Made Simple
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Let our intelligent trading bot work for you. Automated investing
            with advanced risk management, 24/7 monitoring, and proven
            strategies.
          </p>
          <button className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold shadow-lg hover:shadow-xl transition flex items-center mx-auto gap-2">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>
        </div>
      </section>

      {/* Tutorial Section */}
      <section id="tutorial" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Sign Up</h3>
              <p className="text-gray-600">
                Create your account in seconds with Google authentication
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Configure Settings</h3>
              <p className="text-gray-600">
                Set your risk level, investment amount, and trading preferences
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Start Trading</h3>
              <p className="text-gray-600">
                Activate the bot and let it execute trades automatically
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">4</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Monitor & Profit</h3>
              <p className="text-gray-600">
                Track performance in real-time and watch your portfolio grow
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Powerful Features
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Bot className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-2xl font-semibold mb-4">
                Automated Strategies
              </h3>
              <p className="text-gray-600">
                Advanced algorithms execute trades 24/7 based on proven trading
                strategies and market analysis.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Shield className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-2xl font-semibold mb-4">Risk Control</h3>
              <p className="text-gray-600">
                Set maximum loss limits, stop-loss orders, and define your risk
                tolerance to protect your capital.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <BarChart3 className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-2xl font-semibold mb-4">Real-Time Analytics</h3>
              <p className="text-gray-600">
                Monitor your portfolio with live charts, detailed trade history,
                and comprehensive performance metrics.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Lock className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-2xl font-semibold mb-4">Secure Trading</h3>
              <p className="text-gray-600">
                Bank-level encryption and secure API connections ensure your
                data and funds are always protected.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Zap className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-2xl font-semibold mb-4">Lightning Fast</h3>
              <p className="text-gray-600">
                Execute trades in milliseconds to capitalize on market
                opportunities before they disappear.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <TrendingUp className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-2xl font-semibold mb-4">Smart Portfolio</h3>
              <p className="text-gray-600">
                Diversify across multiple assets with intelligent allocation and
                rebalancing strategies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div>
              <Shield className="h-16 w-16 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Secure Trading</h3>
              <p className="text-blue-100">
                Your data and funds are protected with industry-leading security
                standards
              </p>
            </div>
            <div>
              <Bot className="h-16 w-16 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Automated Strategies</h3>
              <p className="text-blue-100">
                Proven algorithms that adapt to market conditions in real-time
              </p>
            </div>
            <div>
              <Lock className="h-16 w-16 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Risk Control</h3>
              <p className="text-blue-100">
                Advanced risk management tools to protect your investments
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                question: "How does automated trading work?",
                answer:
                  "Our platform uses advanced algorithms to analyze market trends and execute trades automatically based on your configured settings. You set your risk tolerance and investment parameters, and the bot handles the rest.",
              },
              {
                question: "Is my money safe?",
                answer:
                  "Yes. We use bank-level encryption and secure API connections. Your trading API keys are stored encrypted, and we never have direct access to your funds. You maintain full control through your exchange account.",
              },
              {
                question: "What assets can I trade?",
                answer:
                  "Currently, we support major cryptocurrencies including Bitcoin, Ethereum, and other popular digital assets. We're constantly expanding our supported asset list.",
              },
              {
                question: "Can I stop trading at any time?",
                answer:
                  "Absolutely. You have full control to start or stop the trading bot at any moment. All active positions will be closed according to your exit strategy when you stop trading.",
              },
              {
                question: "What are the fees?",
                answer:
                  "We charge a small percentage of profits generated. There are no upfront costs or monthly subscriptions. You only pay when you profit.",
              },
            ].map((faq, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition"
                >
                  <span className="font-semibold text-gray-900">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-500 transition-transform ${
                      openFaq === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <TrendingUp className="h-8 w-8 text-blue-500" />
                <span className="ml-2 text-xl font-bold">TradePro</span>
              </div>
              <p className="text-gray-400">
                Automated trading made simple and secure.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#features" className="hover:text-white transition">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#tutorial" className="hover:text-white transition">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Careers
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2026 TradePro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
