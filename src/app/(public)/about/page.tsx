"use client";

export default function AboutPage() {
  return (
    <div className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-dark mb-4">
            About MaintainEx
          </h1>
          <p className="text-lg text-gray-600">
            Connecting homeowners with trusted professionals since 2024
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-bold text-dark mb-4">Our Story</h2>
          <p className="text-gray-600 mb-4">
            MaintainEx was founded with a simple mission: to make home maintenance and repairs accessible, reliable, and stress-free for everyone. We believe every homeowner deserves access to skilled professionals they can trust.
          </p>
          <p className="text-gray-600">
            Whether you need furniture assembled, a TV mounted, help moving, or a deep clean, our platform connects you with vetted professionals who get the job done right.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <div className="text-3xl font-bold text-primary-dark mb-2">3.4M+</div>
            <p className="text-gray-600">Tasks Completed</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <div className="text-3xl font-bold text-primary-dark mb-2">50K+</div>
            <p className="text-gray-600">Taskers</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <div className="text-3xl font-bold text-primary-dark mb-2">50</div>
            <p className="text-gray-600">Cities</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
          <h2 className="text-2xl font-bold text-dark mb-4">Why Choose MaintainEx?</h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-dark text-xs font-bold">✓</span>
              </span>
              <div>
                <p className="font-semibold text-dark">Vetted Professionals</p>
                <p className="text-gray-600 text-sm">All Taskers pass background checks</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-dark text-xs font-bold">✓</span>
              </span>
              <div>
                <p className="font-semibold text-dark">Happy Guarantee</p>
                <p className="text-gray-600 text-sm">We&apos;ll make it right if you&apos;re not satisfied</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-dark text-xs font-bold">✓</span>
              </span>
              <div>
                <p className="font-semibold text-dark">Secure Payments</p>
                <p className="text-gray-600 text-sm">Pay securely through the app</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-dark text-xs font-bold">✓</span>
              </span>
              <div>
                <p className="font-semibold text-dark">24/7 Support</p>
                <p className="text-gray-600 text-sm">We&apos;re here to help anytime</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}