export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
}

export const githubService = {
  fetchRepos: async (token: string): Promise<GitHubRepo[]> => {
    const response = await fetch("https://api.github.com/user/repos?sort=updated", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    
    if (!response.ok) throw new Error("Failed to fetch repositories");
    return await response.json();
  },

  runAudit: async (repoName: string) => {
    const response = await fetch("/api/audit/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoName }),
    });
    
    if (!response.ok) throw new Error("Audit failed");
    return await response.json();
  },

  getFileContent: async (repoFullName: string, path: string, token: string): Promise<string> => {
    const response = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${path}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) throw new Error(`Failed to fetch file: ${path}`);
    const data = await response.json();
    
    // GitHub content is base64 encoded
    if (data.content) {
      return atob(data.content.replace(/\n/g, ''));
    }
    
    throw new Error("No content found in file");
  }
};
