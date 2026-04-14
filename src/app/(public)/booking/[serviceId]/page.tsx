"use client";

import { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { Button, Input, Textarea } from "@/components/ui";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Calendar, 
  Clock, 
  MapPin,
  User,
  Wrench
} from "lucide-react";

interface BookingPageProps {
  params: Promise<{ serviceId: string }>;
}

const steps = [
  { id: 1, title: "Service", icon: Wrench },
  { id: 2, title: "Date & Time", icon: Clock },
  { id: 3, title: "Details", icon: User },
  { id: 4, title: "Confirm", icon: Check },
];

const timeSlots = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

const dates = Array.from({ length: 14 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() + i + 1);
  return date;
});

export default function BookingPage({ params }: BookingPageProps) {
  const { serviceId } = use(params);
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          ...formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Booking failed");
      }

      setStep(4);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 2) return formData.date && formData.time;
    if (step === 3) return formData.name && formData.email && formData.phone && formData.address;
    return true;
  };

  return (
    <div className="py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link 
          href="/services" 
          className="inline-flex items-center gap-2 text-gray-600 hover:text-dark mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to services
        </Link>

        <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            {steps.map((s, idx) => (
              <div key={s.id} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= s.id ? "bg-primary text-dark" : "bg-gray-200 text-gray-500"
                }`}>
                  {step > s.id ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-12 h-1 mx-2 ${
                    step > s.id ? "bg-primary" : "bg-gray-200"
                  }`} />
                )}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-dark mb-6">Select Service</h2>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Service ID: {serviceId}</p>
              </div>
              <div className="mt-6">
                <Button onClick={() => setStep(2)} className="w-full">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-dark mb-6">Choose Date & Time</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-dark mb-2">Select Date</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                  {dates.slice(0, 7).map((date, i) => {
                    const dateStr = date.toISOString().split("T")[0];
                    return (
                      <button
                        key={i}
                        onClick={() => setFormData({ ...formData, date: dateStr })}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          formData.date === dateStr 
                            ? "border-primary bg-primary-light/30 text-dark" 
                            : "border-gray-200 hover:border-primary"
                        }`}
                      >
                        <div className="text-xs text-gray-500">
                          {date.toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                        <div className="font-semibold">{date.getDate()}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-dark mb-2">Select Time</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {timeSlots.map((time) => (
                    <button
                      key={time}
                      onClick={() => setFormData({ ...formData, time })}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        formData.time === time 
                          ? "border-primary bg-primary-light/30 text-dark" 
                          : "border-gray-200 hover:border-primary"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-error text-sm mb-4">{error}</p>}

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button 
                  onClick={() => setStep(3)} 
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-dark mb-6">Your Details</h2>
              
              <div className="space-y-4">
                <Input
                  label="Full Name"
                  name="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  name="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  name="phone"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Address"
                  name="address"
                  placeholder="123 Main St, City, State"
                  value={formData.address}
                  onChange={handleChange}
                  required
                />
                <Textarea
                  label="Notes (optional)"
                  name="notes"
                  placeholder="Any special instructions..."
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                />
              </div>

              {error && <p className="text-error text-sm mb-4">{error}</p>}

              <div className="flex gap-4 mt-6">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!canProceed() || loading}
                  className="flex-1"
                >
                  {loading ? "Booking..." : "Confirm Booking"}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-dark mb-2">Booking Confirmed!</h2>
              <p className="text-gray-600 mb-6">
                We've sent a confirmation email to {formData.email}
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
                <p><strong>Date:</strong> {formData.date}</p>
                <p><strong>Time:</strong> {formData.time}</p>
                <p><strong>Address:</strong> {formData.address}</p>
              </div>
              <Link href="/">
                <Button>Back to Home</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}