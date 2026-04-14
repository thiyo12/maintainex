"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

interface Project {
  id: string;
  name: string;
  slug: string;
  price: number;
  image?: string;
}

const projects: Project[] = [
  { id: "1", name: "Furniture Assembly", slug: "furniture-assembly", price: 49, image: "/images/assembly.jpg" },
  { id: "2", name: "Mount Art or Shelves", slug: "mount-shelves", price: 65, image: "/images/mounting.jpg" },
  { id: "3", name: "Mount a TV", slug: "mount-tv", price: 69, image: "/images/tv-mount.jpg" },
  { id: "4", name: "Help Moving", slug: "help-moving", price: 67, image: "/images/moving.jpg" },
  { id: "5", name: "Home & Apartment Cleaning", slug: "home-cleaning", price: 49, image: "/images/cleaning.jpg" },
  { id: "6", name: "Minor Plumbing Repairs", slug: "plumbing", price: 74, image: "/images/plumbing.jpg" },
  { id: "7", name: "Electrical Help", slug: "electrical", price: 69, image: "/images/electrical.jpg" },
  { id: "8", name: "Heavy Lifting", slug: "heavy-lifting", price: 61, image: "/images/heavy-lifting.jpg" },
];

export function ProjectsGrid() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-dark text-center mb-4">
          Popular Projects
        </h2>
        <p className="text-gray-600 text-center mb-12">
          Most booked services by our customers
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/service/${project.slug}`}
              className="group block bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden"
            >
              <div className="aspect-[4/3] bg-gray-100 relative">
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                  <span className="text-4xl">🔧</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-dark mb-1 group-hover:text-primary-dark transition-colors">
                  {project.name}
                </h3>
                <p className="text-primary-dark font-semibold">
                  Starting at ${project.price}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/services">
            <Button variant="outline">
              See all projects <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}