import { useStore } from '../store';
import { GoogleGenAI } from "@google/genai";

// Master Birthday List (Months are 0-indexed: 0 = Jan, 11 = Dec)
export const STUDENT_BIRTHDAYS = [
  { month: 0, day: 9, name: "Abby" },
  { month: 0, day: 26, name: "Graham" },
  { month: 1, day: 9, name: "Isabelle" },
  { month: 1, day: 9, name: "Logan" },
  { month: 1, day: 12, name: "Max" },
  { month: 1, day: 23, name: "Stephen" },
  { month: 2, day: 20, name: "Mr. Reagan" },
  { month: 2, day: 28, name: "Evelyn" },
  { month: 2, day: 30, name: "Dominic" },
  { month: 2, day: 30, name: "Elise" },
  // April is empty in your list
  { month: 4, day: 4, name: "Kennedy" },
  { month: 4, day: 16, name: "Charlie Kate" },
  { month: 5, day: 9, name: "Avery" },
  { month: 5, day: 11, name: "Nixon" },
  { month: 6, day: 1, name: "Grayson" },
  { month: 6, day: 1, name: "Madison" },
  { month: 6, day: 14, name: "Landon" },
  { month: 6, day: 22, name: "Beckett" },
  { month: 6, day: 29, name: "Evie" },
  { month: 7, day: 9, name: "Elana" },
  { month: 7, day: 17, name: "Misha" },
  { month: 7, day: 23, name: "Torren" },
  { month: 8, day: 3, name: "Lucy" },
  { month: 9, day: 9, name: "Emma" },
  { month: 10, day: 8, name: "Mia" },
  { month: 11, day: 12, name: "Jack" },
  { month: 11, day: 31, name: "Jace" }
];

const getOrdinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

export const getBirthdaysForMonth = (date: Date) => {
  const month = date.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const bdays = STUDENT_BIRTHDAYS.filter(b => b.month === month).sort((a, b) => a.day - b.day);

  if (bdays.length === 0) {
    return { 
        title: `${monthNames[month]} Birthdays`, 
        html: `<p>We have no student birthdays to celebrate this month!</p>` 
    };
  }

  const listItems = bdays.map(b => `<li>${b.day}${getOrdinal(b.day)} - ${b.name}</li>`).join('');
  return {
    title: `${monthNames[month]} Birthdays`,
    html: `<ul>${listItems}</ul>`
  };
};

// Base Cidi Labs Template
const BASE_TEMPLATE = `
<div id="kl_wrapper_3" class="kl_circle_left kl_wrapper" style="border-style: none;">
    <div id="kl_banner" class="">
        <h1 style="color: #0e68b3; text-align: center;">[HEADER_TITLE]</h1>
        <h3 style="color: #9e58bd; text-align: center;">[HEADER_DATES]</h3>
        
        <h4 style="background: #fbeeb8; padding: 5px;"><span style="background-color: #000000; color: #ffffff;">Important Dates</span></h4>
        [DATES_LIST]
        
        <h4 style="background: #fbeeb8; padding: 5px;"><span style="background-color: #000000; color: #ffffff;">Homeroom News</span></h4>
        [NEWS_CONTENT]
        
        <h4 style="color: #e91e63;">[BIRTHDAY_TITLE]</h4>
        [BIRTHDAY_CONTENT]
        
        <div style="background: #f4f4f4; padding: 10px; margin-top: 20px; font-size: 12px; border-radius: 5px;">
            <strong>Quick Links:</strong><br />
            [QUICK_LINKS]
        </div>
    </div>
</div>
`;

export const newsletterService = {
  async generateNewsletter(pastedContent: string, targetDate: Date): Promise<string> {
    const { geminiApiKey } = useStore.getState();
    const apiKey = geminiApiKey || "";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY_MISSING: Please configure your Gemini API Key in Settings.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const birthdayData = getBirthdaysForMonth(targetDate);
    const currentDate = targetDate.toISOString().split('T')[0];

    const systemPrompt = `
      You are an expert Canvas LMS newsletter builder. 
      Your task is to take the user's pasted rough draft and merge it into a strict HTML template.

      CRITICAL INSTRUCTIONS:
      1. Review the dates provided in the draft. REMOVE any dates that have already passed (Today is ${currentDate}). Keep all future dates.
      2. Format the "Homeroom News" into clean HTML paragraphs <p> and unordered lists <ul> if bullet points are provided.
      3. Format the "Quick Links" as proper HTML <a> tags. Retain any links from the draft.
      4. Ensure the output strictly follows the Cidi Labs inline styling provided in the base template.
      5. Insert the provided Birthday logic exactly as given. Do NOT change the birthdays.
      6. Output ONLY the final raw HTML code. Do NOT wrap the output in \`\`\`html markdown blocks. Do not add conversational text.

      BIRTHDAY CONTENT TO INSERT:
      Title: ${birthdayData.title}
      HTML: ${birthdayData.html}

      BASE TEMPLATE TO USE AND FILL IN:
      ${BASE_TEMPLATE}
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: pastedContent,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.1
        }
      });

      let htmlText = response.text || "";
      
      // Sanitize AI markdown wrapping if it sneaks through
      htmlText = htmlText.replace(/```html/g, '').replace(/```/g, '').trim();

      return htmlText;
    } catch (error) {
      console.error("Newsletter Error:", error);
      throw error;
    }
  }
};
