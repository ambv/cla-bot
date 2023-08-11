export class AgreementListItem {
  id: string | null;
  name: string;
  description: string | null;
  creationTime: Date | null;
}

export class AgreementVersion {
  id: string;
  agreementId?: string | null;
  current: boolean;
  draft: boolean;
  texts?: AgreementText[];
  creationTime: Date;
}

export class AgreementText {
  id: string;
  title: string;
  text: string;
  culture: string;
  versionId?: string | null;
  updateTime: Date;
  creationTime: Date;
}

export interface AgreementTextInput {
  title: string;
  text: string;
  culture: string;
}

/**
 * Basic information about a configured agreement for a repository.
 */
export class RepositoryAgreementInfo {
  versionId: string;
}

export class Agreement extends AgreementListItem {
  versions: AgreementVersion[];
}

export interface AgreementsRepository {
  getAgreements(): Promise<AgreementListItem[]>;

  getCompleteAgreements(): Promise<AgreementListItem[]>;

  getAgreement(agreementId: string): Promise<Agreement | null>;

  getAgreementVersion(versionId: string): Promise<AgreementVersion | null>;

  getAgreementTextForRepository(
    repositoryFullName: string,
    cultureCode: string
  ): Promise<AgreementText | null>;

  getAgreementText(
    versionId: string,
    cultureCode: string
  ): Promise<AgreementText | null>;

  createAgreement(
    name: string,
    description?: string
  ): Promise<AgreementListItem>;

  getCurrentAgreementVersionForRepository(
    fullRepositoryName: string
  ): Promise<RepositoryAgreementInfo | null>;

  updateAgreement(
    id: string,
    name: string,
    description: string
  ): Promise<void>;

  updateAgreementText(id: string, title: string, body: string): Promise<void>;

  updateAgreementVersion(id: string, draft: boolean): Promise<void>;

  createAgreementVersion(
    agreementId: string,
    texts: AgreementTextInput[]
  ): Promise<AgreementVersion>;

  setCurrentAgreementVersion(
    agreementId: string,
    versionId: string
  ): Promise<void>;
}
