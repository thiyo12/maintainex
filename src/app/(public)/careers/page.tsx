"use client";

import { useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";

const services = [
  "Furniture Assembly",
  "Mounting & Installation",
  "Moving Help",
  "Home Cleaning",
  "Plumbing",
  "Electrical",
  "Painting",
  "General Handyman",
];

export default function CareersPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    service: "",
    experience: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Application failed");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-dark mb-4">
            Become a Tasker
          </h1>
          <p className="text-lg text-gray-600">
            Join our network of skilled professionals and earn money on your own schedule
          </p>
        </div>

        {success ? (
          <div className="bg-success/10 border border-success/30 rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-success mb-2">Application Submitted!</h2>
            <p className="text-gray-600">
              We'll review your application and get back to you within 2-3 business days.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Full Name"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Email"
                  type="email"
                  name="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  name="phone"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  Service You Want to Provide
                </label>
                <select
                  name="service"
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="">Select a service</option>
                  {services.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <Textarea
                label="Experience"
                name="experience"
                placeholder="Tell us about your experience..."
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                rows={4}
                required
              />

              {error && <p className="text-error text-sm">{error}</p>}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Submitting..." : "Submit Application"}
              </Button>
            </form>
          </div>
        )}

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6">
            <div className="text-3xl font-bold text-primary-dark mb-2">$50+</div>
            <p className="text-gray-600">Average hourly rate</p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl font-bold text-primary-dark mb-2">7 days</div>
            <p className="text-gray-600">Get paid weekly</p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl font-bold text-primary-dark mb-2">100%</div>
            <p className="text-gray-600">You keep your tips</p>
          </div>
        </div>
      </div>
    </div>
  );
}