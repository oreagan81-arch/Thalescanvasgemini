import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

// Callable references
const deployPagesFn = httpsCallable(functions, 'deployPages');
const deployAssignmentsFn = httpsCallable(functions, 'deployAssignments');
const deployAnnouncementsFn = httpsCallable(functions, 'deployAnnouncements');
const deployNewsletterFn = httpsCallable(functions, 'generateNewsletter');
const runWeekValidatorFn = httpsCallable(functions, 'runWeekValidator');

export const COLORS = {
  BLUE: '#0065a7', // Thales Blue (Banners/Headers)
  PINK: '#c51062', // Reminders
  TEAL: '#00c0a5', // Resources
  DARK_BG: '#333333' // Section Headers
};

export function generateCanvasHeader(title: string): string {
  return `<h2 class="dp-header" style="background-color: ${COLORS.BLUE}; color: white; padding: 15px; border-radius: 4px;">${title}</h2>`;
}

export function generateDayHeader(day: string): string {
  return `<h3 class="dp-header" style="color: ${COLORS.BLUE}; border-bottom: 2px solid ${COLORS.BLUE}; padding-bottom: 5px; margin-top: 25px;">${day}</h3>`;
}

export function generateSectionHeader(title: string): string {
  return `<h4 class="dp-header" style="background-color: ${COLORS.DARK_BG}; color: white; width: 60%; padding: 8px 0 8px 40px; margin-top: 15px;">${title}</h4>`;
}

export function generateReminderHtml(text: string): string {
  if (!text) return '';
  return `<p style="color: ${COLORS.PINK}; font-weight: bold; border-left: 4px solid ${COLORS.PINK}; padding-left: 10px;">Reminder: ${text}</p>`;
}

export function generateResourcesHtml(resources: string[]): string {
  if (!resources || resources.length === 0) return '';
  const list = resources.map(res => `<li style="margin-bottom: 5px;">• ${res}</li>`).join('');
  return `<div style="margin-top: 10px;">
    <span style="color: ${COLORS.TEAL}; font-weight: bold; display: block; margin-bottom: 5px;">Resources:</span>
    <ul style="list-style-type: none; padding: 0; margin-left: 20px;">
      ${list}
    </ul>
  </div>`;
}

export function formatHomeworkReference(text: string, url?: string): string {
  if (!url) return text;
  return `<a href="${url}" target="_blank" rel="noopener" style="color: ${COLORS.BLUE}; text-decoration: underline;">${text}</a>`;
}

export async function deployWeekPages(weekId: string) {
  try {
    const result = await deployPagesFn({ weekId });
    return result.data;
  } catch (err: any) {
    console.error("Canvas deployPages error:", err);
    throw err;
  }
}

export async function deployWeekAssignments(weekId: string) {
  try {
    const result = await deployAssignmentsFn({ weekId });
    return result.data;
  } catch (err: any) {
    console.error("Canvas deployAssignments error:", err);
    throw err;
  }
}

export async function validateWeekBeforeDeploy(weekId: string) {
  try {
    const result = await runWeekValidatorFn({ weekId });
    return result.data;
  } catch (err: any) {
    console.error("Week Validator error:", err);
    throw err;
  }
}
