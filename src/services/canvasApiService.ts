/**
 * Service to interact with the Canvas LMS API.
 */
export const canvasApiService = {
  /**
   * Posts an announcement to a specific Canvas course.
   */
  postAnnouncement: async (
    title: string,
    messageHTML: string,
    courseId: string,
    apiToken: string
  ): Promise<any> => {
    if (!apiToken) {
      throw new Error("CANVAS_API_TOKEN_MISSING: Please provide your Canvas API Token in Settings.");
    }
    if (!courseId) {
      throw new Error("CANVAS_COURSE_ID_MISSING: Please provide the target Canvas Course ID in Settings.");
    }

    const endpoint = `https://thalesacademy.instructure.com/api/v1/courses/${courseId}/discussion_topics`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          message: messageHTML,
          is_announcement: true,
          published: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Canvas API Error Details:", errorData);
        
        if (response.status === 401) {
          throw new Error("Canvas API Unauthorized: Your API Token may be invalid or expired.");
        }
        if (response.status === 404) {
          throw new Error(`Canvas Course Not Found: The Course ID ${courseId} appears to be invalid.`);
        }
        
        throw new Error(
          errorData.errors?.[0]?.message || 
          `Canvas API Failed: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error: any) {
      console.error("Canvas API Critical Failure:", error);
      throw error;
    }
  },
};
