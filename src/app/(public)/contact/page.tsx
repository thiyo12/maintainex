"use client";

import { useState } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { Mail, Phone, MapPin } from "lucide-react";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-dark mb-4">
            Contact Us
          </h1>
          <p className="text-lg text-gray-600">
            We're here to help with any questions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
              {success ? (
                <div className="text-center py-8">
                  <h2 className="text-2xl font-bold text-success mb-2">Message Sent!</h2>
                  <p className="text-gray-600">
                    We'll get back to you as soon as possible.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <Input
                    label="Name"
                    name="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />

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
                  />

                  <Textarea
                    label="Message"
                    name="message"
                    placeholder="How can we help?"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={5}
                    required
                  />

                  {error && <p className="text-error text-sm">{error}</p>}

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-dark" />
              </div>
              <div>
                <h3 className="font-semibold text-dark mb-1">Email</h3>
                <p className="text-gray-600">hello@maintainex.com</p>
                <p className="text-sm text-gray-500">We reply within 24 hours</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-dark" />
              </div>
              <div>
                <h3 className="font-semibold text-dark mb-1">Phone</h3>
                <p className="text-gray-600">(555) 123-4567</p>
                <p className="text-sm text-gray-500">Mon-Fri 9am-6pm</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-dark" />
              </div>
              <div>
                <h3 className="font-semibold text-dark mb-1">Address</h3>
                <p className="text-gray-600">123 Main Street</p>
                <p className="text-gray-600">City, State 12345</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}