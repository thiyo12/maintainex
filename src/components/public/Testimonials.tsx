"use client";

import { Star } from "lucide-react";

interface Testimonial {
  id: string;
  name: string;
  service: string;
  comment: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Elizabeth P.",
    service: "Furniture Assembly",
    comment: "Vitalii assembled my IKEA Norli drawer chest in less than 30 minutes. He also fixed a drawer on my desk so it extends further.",
    rating: 5,
  },
  {
    id: "2",
    name: "Tiffany B.",
    service: "Furniture Assembly",
    comment: "David did an awesome job assembling crib and dresser for nursery. He cleaned up the area after his work.",
    rating: 5,
  },
  {
    id: "3",
    name: "Amanda L.",
    service: "Home Repairs",
    comment: "Joe was great with communication, was fast, professional and did a fantastic job patching holes on my wall and ceiling.",
    rating: 5,
  },
  {
    id: "4",
    name: "Sabrina K.",
    service: "Electrical Help",
    comment: "Aleksandr was fantastic! He came with all the equipment, even the hardware I didn't know I would need. 100% would hire again.",
    rating: 5,
  },
  {
    id: "5",
    name: "Jana T.",
    service: "Plumbing",
    comment: "Jose fixed my AC drain line which was clogging my bathroom sink. He was prompt, communicative, and efficient.",
    rating: 5,
  },
  {
    id: "6",
    name: "Elisa R.",
    service: "General Mounting",
    comment: "Michael did a great job helping us install frameless glass shower doors. He was patient and willing to figure it out with us.",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-dark text-center mb-4">
          What happy customers are saying
        </h2>
        <p className="text-gray-600 text-center mb-12">
          Real reviews from real customers
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex gap-1 mb-3">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                "{t.comment}"
              </p>
              <div className="border-t border-gray-100 pt-3">
                <p className="font-semibold text-dark">{t.name}</p>
                <p className="text-sm text-gray-500">{t.service}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}