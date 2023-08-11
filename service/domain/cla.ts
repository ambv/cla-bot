export interface ClaCheckRepository {
  id: number;
  owner: string;
  ownerId: number;
  name: string;
  fullName: string;
}

export interface ClaCheckPullRequest {
  id: number;
  number: number;
  headSha: string;
  url: string;
}

export interface ClaCheckInput {
  gitHubUserId: number;
  authors: string[] | null;
  agreementVersionId?: string | null;
  repository: ClaCheckRepository;
  pullRequest: ClaCheckPullRequest;
}

export interface ClaCheckState extends ClaCheckInput {
  commentId: string;
}

export class ContributorLicenseAgreement {
  id: string | null;
  email: string;
  username: string | null;
  versionId: string;
  signedAt: Date;
}

export interface ClasImportEntry {
  id: string;
  email: string;
  username: string;
}

export interface ClasImportInput {
  agreementId: string;
  entries: ClasImportEntry[];
}

export interface ClasImportEntryResult {
  success: boolean;
  entry: ClasImportEntry;
  error?: string;
}

export interface ClasImportOutput {
  results: ClasImportEntryResult[];
}

export interface ClaRepository {
  getClaByEmailAddress(
    email: string
  ): Promise<ContributorLicenseAgreement | null>;

  saveCla(data: ContributorLicenseAgreement): Promise<void>;
}
