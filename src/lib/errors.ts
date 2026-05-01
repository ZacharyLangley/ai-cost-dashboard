export class GitHubNotFoundError extends Error {
  constructor(path: string) {
    super(`GitHub API 404: ${path}`);
    this.name = 'GitHubNotFoundError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}
