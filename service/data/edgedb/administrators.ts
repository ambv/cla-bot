import e from "../../../dbschema/edgeql-js";

import {EdgeDBRepository} from "./base";
import {injectable} from "inversify";
import {
  AdministratorsRepository,
  Administrator,
} from "../../domain/administrators";

@injectable()
export class EdgeDBAdministratorsRepository
  extends EdgeDBRepository
  implements AdministratorsRepository
{
  async getAdministrators(): Promise<Administrator[]> {
    return await this.run(async (connection) => {
      return e
        .select(e.Administrator, () => ({
          id: true,
          email: true,
        }))
        .run(connection);
    });
  }

  async getAdministratorByEmail(email: string): Promise<Administrator | null> {
    return await this.run(async (connection) => {
      return e
        .select(e.Administrator, (admin) => ({
          id: true,
          email: true,
          filter_single: {email},
        }))
        .run(connection);
    });
  }

  async addAdministrator(email: string): Promise<void> {
    await this.run(async (connection) => {
      await e
        .insert(e.Administrator, {
          email: email,
        })
        .run(connection);
    });
  }

  async removeAdministrator(id: string): Promise<void> {
    await this.run(async (connection) => {
      await e
        .delete(e.Administrator, (a) => ({
          filter: e.op(a.id, "=", e.uuid(id)),
        }))
        .run(connection);
    });
  }
}
