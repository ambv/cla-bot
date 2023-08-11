import e from "../../../dbschema/edgeql-js";

import {EdgeDBRepository} from "./base";
import {injectable} from "inversify";
import {RepositoriesRepository, Repository} from "../../domain/repositories";

@injectable()
export class EdgeDBRepositoriesRepository
  extends EdgeDBRepository
  implements RepositoriesRepository
{
  async getConfiguredRepositories(): Promise<Repository[]> {
    return await this.run(async (connection) =>
      e
        .select(e.Repository, (repo) => ({
          id: true,
          fullName: repo.full_name,
          agreementId: repo.agreement.id,
          agreementName: repo.agreement.name,
        }))
        .run(connection)
    );
  }

  async createRepositoryConfiguration(
    agreementId: string,
    repositoryId: string
  ): Promise<void> {
    await this.run(async (connection) =>
      e
        .insert(e.Repository, {
          full_name: repositoryId,
          agreement: e.select(e.Agreement, (a) => ({
            filter_single: {id: agreementId},
          })),
        })
        .run(connection)
    );
  }

  async deleteRepositoryConfiguration(id: string): Promise<void> {
    await this.run(async (connection) =>
      e
        .delete(e.Repository, (repo) => ({
          filter_single: {id},
        }))
        .run(connection)
    );
  }
}
