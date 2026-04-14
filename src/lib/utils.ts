import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function generateTimeSlots(
  startHour: number = 8,
  endHour: number = 18,
  intervalMinutes: number = 60
): string[] {
  const slots: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += intervalMinutes) {
      slots.push(`${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
    }
  }
  return slots;
}

export function isTimeSlotAvailable(
  bookedSlots: string[],
  targetSlot: string,
  duration: number
): boolean {
  const targetStart = parseInt(targetSlot.split(":")[0]) * 60 + parseInt(targetSlot.split(":")[1]);
  const targetEnd = targetStart + duration;

  for (const slot of bookedSlots) {
    const bookedStart = parseInt(slot.split(":")[0]) * 60 + parseInt(slot.split(":")[1]);
    if (targetStart < bookedStart + 15 && targetEnd > bookedStart) {
      return false;
    }
  }
  return true;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

export function getRandomColor(): string {
  const colors = [
    "#FFC300",
    "#059669",
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
    "#F59E0B",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}