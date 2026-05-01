export class GitHubNotFoundError extends Error {
  constructor(path: string) {
    super(`GitHub API 404: ${path}`);
    this.name = 'GitHubNotFoundError';
  }
}
