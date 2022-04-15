import {EdgeDBRepository} from "./base";
import {injectable} from "inversify";
import {
  AgreementsRepository,
  AgreementListItem,
  AgreementText,
  RepositoryAgreementInfo,
  Agreement,
  AgreementVersion,
  AgreementTextInput,
} from "../../domain/agreements";
import {ServerError} from "../../common/app";

// The following interfaces describe the shape of DB entities,

interface TextEntity {
  id: string;
  title: string;
  text: string;
  culture: string;
  update_time: Date;
  creation_time: Date;
}

interface VersionEntity {
  id: string;
  current: boolean;
  draft: boolean;
  creation_time: string;
  agreement_id?: string[];
  texts?: TextEntity[];
}

function mapTextEntity(entity: TextEntity): AgreementText {
  return new AgreementText(
    entity.id,
    entity.title,
    entity.text,
    entity.culture,
    "",
    new Date(entity.update_time),
    new Date(entity.creation_time)
  );
}

function mapVersionEntity(entity: VersionEntity): AgreementVersion {
  return new AgreementVersion(
    entity.id,
    entity.current,
    entity.draft,
    entity.agreement_id ? entity.agreement_id[0] : undefined,
    new Date(entity.creation_time),
    entity.texts ? entity.texts.map(mapTextEntity) : undefined
  );
}

@injectable()
export class EdgeDBAgreementsRepository
  extends EdgeDBRepository
  implements AgreementsRepository
{
  async getAgreement(agreementId: string): Promise<Agreement | null> {
    const agreement = await this.run(async (connection) => {
      return await connection.querySingle<{
        id: string;
        name: string;
        description: string;
        creation_time: Date;
        versions: VersionEntity[];
      }>(
        `SELECT Agreement {
          name,
          description,
          creation_time,
          versions: {
            current,
            draft,
            creation_time
          } ORDER BY .current DESC
        }  FILTER .id = <uuid>$id;`,
        {
          id: agreementId,
        }
      );
    });

    if (!agreement) return null;

    return new Agreement(
      agreement.id,
      agreement.name,
      agreement.description,
      agreement.creation_time,
      agreement.versions.map(mapVersionEntity)
    );
  }

  async getAgreementVersion(
    versionId: string
  ): Promise<AgreementVersion | null> {
    const item = await this.run(async (connection) => {
      return await connection.querySingle<VersionEntity>(
        `SELECT AgreementVersion {
          current,
          draft,
          creation_time,
          agreement_id := .<versions[IS Agreement].id,
          texts: {
            text,
            title,
            culture,
            update_time,
            creation_time
          }
        }  FILTER .id = <uuid>$id;`,
        {
          id: versionId,
        }
      );
    });

    if (!item) return null;

    return mapVersionEntity(item);
  }

  async updateAgreement(
    id: string,
    name: string,
    description: string
  ): Promise<void> {
    await this.run(async (connection) => {
      await connection.queryRequiredSingle(
        `
        UPDATE Agreement
        FILTER .id = <uuid>$id
        SET {
          name := <str>$name,
          description := <str>$description,
          update_time := <datetime>$update_time,
        }
        `,
        {
          id,
          name,
          description,
          update_time: new Date(),
        }
      );
    });
  }

  async updateAgreementText(
    id: string,
    title: string,
    body: string
  ): Promise<void> {
    await this.run(async (connection) => {
      await connection.queryRequiredSingle(
        `
        UPDATE AgreementText
        FILTER .id = <uuid>$id
        SET {
          title := <str>$title,
          text := <str>$body,
          update_time := <datetime>$update_time,
        }
        `,
        {
          id,
          title,
          body,
          update_time: new Date(),
        }
      );
    });
  }

  async updateAgreementVersion(id: string, draft: boolean): Promise<void> {
    await this.run(async (connection) => {
      await connection.queryRequiredSingle(
        `
        UPDATE AgreementVersion
        FILTER .id = <uuid>$id
        SET {
          draft := <bool>$draft
        }
        `,
        {
          id,
          draft,
        }
      );
    });
  }

  async getCurrentAgreementVersionForRepository(
    repositoryFullName: string
  ): Promise<RepositoryAgreementInfo | null> {
    const item = await this.run(async (connection) => {
      return await connection.querySingle<{
        id: string;
        agreement: {currentVersion: {id: string} | null};
      }>(
        `SELECT Repository {
          agreement: {
            currentVersion := assert_single(
              .versions {
                id
              } FILTER .current = True and .texts.culture = <str>$culture
            )
          }
        } FILTER .full_name = <str>$full_name;`,
        {
          culture: "en",
          full_name: repositoryFullName,
        }
      );
    });

    if (!item) return null;

    const currentVersion = item.agreement.currentVersion;
    if (!currentVersion) {
      return null;
    }
    return new RepositoryAgreementInfo(currentVersion.id);
  }

  async getAgreementTextForRepository(
    repositoryFullName: string,
    cultureCode: string
  ): Promise<AgreementText | null> {
    const item = await this.run(async (connection) => {
      return await connection.querySingle<{
        agreement: {
          currentVersion: {
            id: string;
            text: {
              id: string;
              text: string;
              title: string;
              culture: string;
              update_time: Date;
              creation_time: Date;
            };
          };
        };
      }>(
        `SELECT Repository {
          agreement: {
            currentVersion := assert_single(
              .versions {
                text := assert_single (
                  .texts {
                    text,
                    title,
                    culture,
                    update_time,
                    creation_time
                  } FILTER .culture = <str>$culture
                )
              } FILTER .current = True
            )
          }
        } FILTER .full_name = <str>$full_name;`,
        {
          culture: cultureCode,
          full_name: repositoryFullName,
        }
      );
    });

    if (!item) return null;

    const currentVersion = item.agreement.currentVersion;
    const versionText = currentVersion.text;
    const text = mapTextEntity(versionText);
    text.versionId = currentVersion.id;
    return text;
  }

  async getAgreementText(
    versionId: string,
    cultureCode: string
  ): Promise<AgreementText | null> {
    const version = await this.run(async (connection) => {
      return await connection.querySingle<{
        id: string;
        text: {text: string; title: string; culture: string};
      }>(
        `SELECT AgreementVersion {
          text := assert_single(
            .texts {
              text,
              title,
              culture
            } FILTER .culture = <str>$culture
          )
        } FILTER .id = <uuid>$version_id;`,
        {
          culture: cultureCode,
          version_id: versionId,
        }
      );
    });

    if (!version) return null;

    const versionText = version.text as TextEntity;
    return mapTextEntity(versionText);
  }

  async getAgreements(): Promise<AgreementListItem[]> {
    const items = await this.run(async (connection) => {
      return await connection.query<{
        id: string;
        name: string;
        description: string;
        creation_time: Date;
      }>(
        `SELECT Agreement {
          name,
          description,
          creation_time
        };`
      );
    });

    return items.map(
      (entity) =>
        new AgreementListItem(
          entity.id,
          entity.name,
          entity.description,
          entity.creation_time
        )
    );
  }

  async getCompleteAgreements(): Promise<AgreementListItem[]> {
    const items = await this.run(async (connection) => {
      return await connection.query<{
        id: string;
        name: string;
        description: string;
        creation_time: Date;
      }>(
        `SELECT Agreement {
          name,
          description,
          creation_time
        } FILTER .versions.current = True;`
      );
    });

    return items.map(
      (entity) =>
        new AgreementListItem(
          entity.id,
          entity.name,
          entity.description,
          entity.creation_time
        )
    );
  }

  async createAgreement(
    name: string,
    description?: string
  ): Promise<AgreementListItem> {
    // For best UX, a new agreement is created with a starting
    // version and English text

    return await this.run(async (connection) => {
      const creationTime = new Date();
      const item = await connection.queryRequiredSingle<{id: string}>(
        `
        INSERT Agreement {
          name := <str>$name,
          description := <str>$description,
          creation_time := <datetime>$creation_time,
          versions := {
              (INSERT AgreementVersion {
                  current := False,
                  texts := (
                      (INSERT AgreementText {
                          title := <str>$initial_title,
                          text := <str>$initial_text,
                          culture := <str>$initial_culture,
                          update_time := datetime_current()
                      })
                  )
              })
          }
        };
        `,
        {
          name: name,
          description: description || "",
          creation_time: creationTime,
          initial_title: name,
          initial_text: "# Modify this markdown",
          initial_culture: "en",
        }
      );
      return new AgreementListItem(item.id, name, description, creationTime);
    });
  }

  async setCurrentAgreementVersion(
    agreementId: string,
    versionId: string
  ): Promise<void> {
    await this.run(async (connection) => {
      await connection.query(
        `
      WITH X := (SELECT AgreementVersion {
        id,
        agreement_id := .<versions[IS Agreement].id
      }
      FILTER .agreement_id = <uuid>$agreement_id)
      UPDATE X
      SET {
          current := (.id = <uuid>$version_id)
      };
      `,
        {
          agreement_id: agreementId,
          version_id: versionId,
        }
      );
    });
  }

  async createAgreementVersion(
    agreementId: string,
    texts: AgreementTextInput[]
  ): Promise<AgreementVersion> {
    //
    // TODO: implement support for more than one text;
    // This is not necessary for now, because the application supports only
    // English language.

    const {title, text, culture} = texts[0];

    return await this.run(async (connection) => {
      const item = await connection.querySingle(
        `
        UPDATE Agreement
        FILTER
            .id = <uuid>$agreementId
        SET {
            versions += (
              INSERT AgreementVersion {
                current := False,
                texts := (
                    (INSERT AgreementText {
                        title := <str>$title,
                        text := <str>$text,
                        culture := <str>$culture,
                        update_time := datetime_current()
                    })
                )
              }
            )
        }
        `,
        {
          agreementId,
          title,
          text,
          culture,
        }
      );

      if (!item) throw new ServerError("Expected a result.");

      // TODO: how to get the new item id?
      // I would like to return it
      return mapVersionEntity(item as VersionEntity);
    });
  }
}
