"use client";

import Link from "next/link";
import { 
  Sofa, 
  MonitorUp, 
  Truck, 
  Sparkles, 
  Trees, 
  Wrench, 
  Paintbrush,
  ArrowRight
} from "lucide-react";

const categories = [
  { name: "Assembly", slug: "assembly", icon: Sofa },
  { name: "Mounting", slug: "mounting", icon: MonitorUp },
  { name: "Moving", slug: "moving", icon: Truck },
  { name: "Cleaning", slug: "cleaning", icon: Sparkles },
  { name: "Outdoor Help", slug: "outdoor", icon: Trees },
  { name: "Home Repairs", slug: "repairs", icon: Wrench },
  { name: "Painting", slug: "painting", icon: Paintbrush },
];

export function Hero() {
  return (
    <section className="relative bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-dark mb-4">
            Book trusted help for home tasks
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Get skilled Taskers to help with assembly, mounting, moving, cleaning, and more.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/services?cat=${cat.slug}`}
              className="flex flex-col items-center justify-center p-4 md:p-6 rounded-xl border-2 border-gray-100 hover:border-primary hover:bg-primary-light/30 transition-all duration-200 group"
            >
              <cat.icon className="w-8 h-8 md:w-10 md:h-10 text-dark group-hover:text-primary-dark mb-2" />
              <span className="text-sm md:text-base font-medium text-dark text-center">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link 
            href="/services" 
            className="inline-flex items-center gap-2 text-primary-dark font-semibold hover:underline"
          >
            See all services <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}