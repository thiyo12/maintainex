"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Check, X, Clock, Edit } from "lucide-react";

interface Booking {
  id: string;
  date: string;
  timeSlot: string;
  status: string;
  notes: string | null;
  totalPrice: number;
  user: { name: string; email: string };
  service: { name: string };
  branch: { name: string };
}

const statusColors: Record<string, string> = {
  PENDING: "bg-warning/20 text-warning",
  CONFIRMED: "bg-primary/20 text-primary-dark",
  IN_PROGRESS: "bg-blue-500/20 text-blue-400",
  COMPLETED: "bg-success/20 text-success",
  CANCELLED: "bg-error/20 text-error",
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchBookings();
  }, [filter]);

  const fetchBookings = async () => {
    try {
      const url = `/api/bookings${filter ? `?status=${filter}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchBookings();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-dark-mid text-white px-4 py-2 rounded-lg border border-gray-600"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="bg-dark-mid rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Service</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Customer</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Date</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Time</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Status</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Total</th>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-800/50">
                  <td className="px-6 py-4 text-white">{booking.service.name}</td>
                  <td className="px-6 py-4 text-gray-300">
                    <p className="text-white">{booking.user.name}</p>
                    <p className="text-sm text-gray-500">{booking.user.email}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {new Date(booking.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-gray-300">{booking.timeSlot}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[booking.status]}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white">${booking.totalPrice}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {booking.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => updateStatus(booking.id, "CONFIRMED")}
                            className="p-2 bg-success/20 text-success rounded-lg hover:bg-success/30"
                            title="Confirm"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateStatus(booking.id, "CANCELLED")}
                            className="p-2 bg-error/20 text-error rounded-lg hover:bg-error/30"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {booking.status === "CONFIRMED" && (
                        <button
                          onClick={() => updateStatus(booking.id, "IN_PROGRESS")}
                          className="p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30"
                          title="Start"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      )}
                      {booking.status === "IN_PROGRESS" && (
                        <button
                          onClick={() => updateStatus(booking.id, "COMPLETED")}
                          className="p-2 bg-success/20 text-success rounded-lg hover:bg-success/30"
                          title="Complete"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}