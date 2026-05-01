import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date range into the full institutional format.
 * Example: July 12-16, 2026
 */
export function formatDateRange(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return "TBD";
  
  try {
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    const months = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    
    const startMonth = months[start.getMonth()];
    const startDay = start.getDate();
    const endDay = end.getDate();
    const year = start.getFullYear();
    
    // Check if it spans across months (less common for a 5-day school week but possible)
    if (start.getMonth() !== end.getMonth()) {
       return `${startMonth} ${startDay} - ${months[end.getMonth()]} ${endDay}, ${year}`;
    }
    
    return `${startMonth} ${startDay}-${endDay}, ${year}`;
  } catch (e) {
    console.error("Date formatting error:", e);
    return `${startStr} - ${endStr}`;
  }
}
