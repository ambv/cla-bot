export class ExternalRepository {
  id: number;
  name: string;
  fullName: string;

  constructor(id: number, name: string, fullName: string) {
    this.id = id;
    this.name = name;
    this.fullName = fullName;
  }
}

export class Repository {
  id: string;
  fullName: string;
  agreementId: string;
  agreementName: string;
}

/**
 * Interface to an external API, used to handle information about
 * source code repositories.
 */
export interface RepositoriesService {
  getRepositories(organization: string): Promise<ExternalRepository[]>;
}

/**
 * Interface to an internal persistence layer, used to handle information
 * about repositories, stored by the system.
 */
export interface RepositoriesRepository {
  getConfiguredRepositories(): Promise<Repository[]>;

  createRepositoryConfiguration(
    agreementId: string,
    repositoryFullName: string
  ): Promise<void>;

  deleteRepositoryConfiguration(id: string): Promise<void>;
}
