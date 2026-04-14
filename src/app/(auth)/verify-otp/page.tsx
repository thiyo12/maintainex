"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { Wrench, Mail } from "lucide-react";

export default function VerifyOTPPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOTP] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Wrench className="w-7 h-7 text-dark" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-dark mt-4">Check your email</h1>
          <p className="text-gray-600 mt-2">We sent a verification code to your email</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-gray-400" />
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-2 text-center">
                Enter 6-digit code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]*"
                value={otp}
                onChange={(e) => setOTP(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-4 py-4 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="000000"
                required
              />
            </div>

            {error && (
              <p className="text-error text-sm text-center">{error}</p>
            )}

            <Button type="submit" disabled={loading || otp.length < 6} className="w-full">
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Didn't receive the code?{" "}
            <button type="button" className="text-primary-dark font-medium hover:underline">
              Resend
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}