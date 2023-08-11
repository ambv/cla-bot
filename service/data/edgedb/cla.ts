import e from "../../../dbschema/edgeql-js";

import {ContributorLicenseAgreement, ClaRepository} from "../../domain/cla";
import {EdgeDBRepository} from "./base";
import {injectable} from "inversify";

@injectable()
export class EdgeDBClaRepository
  extends EdgeDBRepository
  implements ClaRepository
{
  async getClaByEmailAddress(
    email: string
  ): Promise<ContributorLicenseAgreement | null> {
    const ghPseudoEmail = /^(?:[0-9]+)\+([^@]+)@users\.noreply\.github\.com$/;
    const ghPseudoEmailOld = /^([^@+]+)@users\.noreply\.github\.com$/;
    const ghEmailMatches =
      email.match(ghPseudoEmail) || email.match(ghPseudoEmailOld);
    let signed_cla: ContributorLicenseAgreement | null = null;
    if (ghEmailMatches) {
      signed_cla = await this.run(async (connection) =>
        e
          .assert_single(
            e.select(e.ContributorLicenseAgreement, (a) => ({
              id: true,
              email: true,
              username: true,
              signedAt: a.creation_time,
              versionId: a.agreement_version.id,

              filter: e.op(
                a.normalized_username,
                "=",
                e.str_lower(ghEmailMatches[1])
              ),

              order_by: a.email,

              limit: 1,
            }))
          )
          .run(connection)
      );
    } else {
      let normalized_email: string | null = await this.run(async (connection) => {
        return await connection.querySingle<string>(
          `SELECT normalize_email(<str>$0);`,
          [email]
        );
      });
      signed_cla = await this.run(async (connection) =>
        e
          .assert_single(
            e.select(e.ContributorLicenseAgreement, (a) => ({
              id: true,
              email: true,
              username: true,
              signedAt: a.creation_time,
              versionId: a.agreement_version.id,

              filter: e.op(a.normalized_email, "=", normalized_email || email),
            }))
          )
          .run(connection)
      );
    }

    return signed_cla;
  }

  async saveCla(data: ContributorLicenseAgreement): Promise<void> {
    await this.run(async (connection) =>
      e
        .insert(e.ContributorLicenseAgreement, {
          email: data.email,
          username: data.username,
          agreement_version: e.assert_exists(
            e.select(e.AgreementVersion, (a) => ({
              filter_single: {id: data.versionId},
            }))
          ),
          creation_time: data.signedAt,
        })
        .run(connection)
    );
  }
}
