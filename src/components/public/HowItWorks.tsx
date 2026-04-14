"use client";

import { Search, Calendar, CheckCircle } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Choose a Tasker",
    description: "Browse by price, skills, and reviews to find the right professional for your task.",
    icon: Search,
  },
  {
    number: 2,
    title: "Schedule a Tasker",
    description: "Book as early as today or schedule for a future date that works for you.",
    icon: Calendar,
  },
  {
    number: 3,
    title: "Chat, Pay & Review",
    description: "Communicate in the app, pay securely, and leave a review after the job is done.",
    icon: CheckCircle,
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-dark text-center mb-4">
          How it works
        </h2>
        <p className="text-gray-600 text-center mb-12">
          Get help in three simple steps
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <step.icon className="w-10 h-10 text-dark" />
              </div>
              <div className="text-5xl font-bold text-gray-200 mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-semibold text-dark mb-3">
                {step.title}
              </h3>
              <p className="text-gray-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}