import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { githubService, GitHubRepo } from '../services/service.github';
import { protocolService } from '../services/service.protocol';
import { syncService } from '../services/service.sync';
import { useStore } from '../store';

export function useDashboardLogic() {
  const addLog = useStore((state) => state.addLog);
  
  const [gitToken, setGitToken] = useState<string | null>(localStorage.getItem('github_token'));
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [auditing, setAuditing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    if (!gitToken) return;
    try {
      setLoadingRepos(true);
      addLog("Fetching cloud repository index...");
      const data = await githubService.fetchRepos(gitToken);
      setRepos(data);
      addLog(`Synchronized ${data.length} repositories.`);
    } catch (err) {
      console.error(err);
      toast.error("Cloud Repository Sync Failed");
    } finally {
      setLoadingRepos(false);
    }
  }, [gitToken, addLog]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        const token = event.data.token;
        setGitToken(token);
        localStorage.setItem('github_token', token);
        toast.success("GitHub Connected");
        addLog("GitHub Handshake Successful: Indexing Nodes...");
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addLog]);

  useEffect(() => {
    if (gitToken) {
      loadRepos();
    }
  }, [gitToken, loadRepos]);

  const handleConnectGit = async () => {
    try {
      addLog("Initializing GitHub Handshake...");
      const res = await fetch("/api/auth/github/url");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch GitHub URL");
      }
      const { url } = await res.json();
      window.open(url, 'github_oauth', 'width=600,height=700');
    } catch (err: any) {
      toast.error(err.message || "Failed to initialize handshake");
    }
  };

  const handlePullUpdates = async (repoFullName: string) => {
    try {
      setSyncing(repoFullName);
      addLog(`Initiating Cloud Merge for: ${repoFullName}...`);
      addLog("Pulling pacing.json from master branch...");
      
      const result = await syncService.pullPacingUpdates(repoFullName, gitToken!);
      
      addLog(result.message);
      toast.success("Cloud Synchronized", {
        description: result.message,
        duration: 5000,
      });
    } catch (err) {
      addLog("CRITICAL: Master Sync Failure. Dependency fetch error.");
      toast.error("Merge Protocol Failure");
    } finally {
      setSyncing(null);
    }
  };

  const runThalesProtocol = async (repoFullName: string) => {
    try {
      setAuditing(repoFullName);
      addLog(`Engaging Thales Protocol Audit for: ${repoFullName}`);
      addLog("Invariants Loaded: Analyzing Friday Rule & Math Test Triple...");
      
      const report = await protocolService.runDeepAudit(repoFullName, gitToken!);
      
      addLog(`Audit Finalized. Score: ${report.score}% - ${report.summary}`);
      toast.success(`Protocol Success: Score ${report.score}`, {
        description: report.findings.length > 0 ? report.findings[0].issue : "No violations found.",
        duration: 5000,
      });
    } catch (err) {
      addLog("CRITICAL: Audit Engine Failure.");
      toast.error("Audit Engine Error");
    } finally {
      setAuditing(null);
    }
  };

  return {
    gitToken,
    repos,
    loadingRepos,
    auditing,
    syncing,
    handleConnectGit,
    handlePullUpdates,
    runThalesProtocol,
    loadRepos
  };
}
