import { Hero, ProjectsGrid, Stats, Testimonials, HowItWorks } from "@/components/public";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <>
      <Hero />
      
      <ProjectsGrid />
      
      <Stats />
      
      <Testimonials />
      
      <HowItWorks />
      
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-dark mb-4">
              Get help today
            </h2>
            <p className="text-gray-600">
              Book now and get help as early as today
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/service/furniture-assembly" className="p-4 bg-gray-50 rounded-lg text-center hover:bg-primary-light/30 transition-colors">
              <span className="font-medium text-dark">Assembly</span>
            </Link>
            <Link href="/service/mount-shelves" className="p-4 bg-gray-50 rounded-lg text-center hover:bg-primary-light/30 transition-colors">
              <span className="font-medium text-dark">Mounting</span>
            </Link>
            <Link href="/service/help-moving" className="p-4 bg-gray-50 rounded-lg text-center hover:bg-primary-light/30 transition-colors">
              <span className="font-medium text-dark">Moving</span>
            </Link>
            <Link href="/service/home-cleaning" className="p-4 bg-gray-50 rounded-lg text-center hover:bg-primary-light/30 transition-colors">
              <span className="font-medium text-dark">Cleaning</span>
            </Link>
            <Link href="/service/tv-mount" className="p-4 bg-gray-50 rounded-lg text-center hover:bg-primary-light/30 transition-colors">
              <span className="font-medium text-dark">TV Mounting</span>
            </Link>
            <Link href="/service/plumbing" className="p-4 bg-gray-50 rounded-lg text-center hover:bg-primary-light/30 transition-colors">
              <span className="font-medium text-dark">Plumbing</span>
            </Link>
            <Link href="/service/electrical" className="p-4 bg-gray-50 rounded-lg text-center hover:bg-primary-light/30 transition-colors">
              <span className="font-medium text-dark">Electrical</span>
            </Link>
            <Link href="/services" className="p-4 bg-gray-50 rounded-lg text-center hover:bg-primary-light/30 transition-colors">
              <span className="font-medium text-primary-dark">All services</span>
            </Link>
          </div>
        </div>
      </section>
      
      <section className="py-16 bg-primary-light/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-dark mb-4">
            Your satisfaction, guaranteed
          </h2>
          <div className="max-w-2xl mx-auto mb-8">
            <p className="text-gray-600 mb-6">
              If you're not satisfied, we'll work to make it right. That's our Happiness Pledge.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="font-semibold text-dark">✓ Vetted Taskers</p>
                <p className="text-sm text-gray-600">Background checked</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="font-semibold text-dark">✓ Dedicated Support</p>
                <p className="text-sm text-gray-600">Available 7 days a week</p>
              </div>
            </div>
          </div>
          <Link href="/services">
            <Button size="lg">Get started</Button>
          </Link>
        </div>
      </section>
    </>
  );
}