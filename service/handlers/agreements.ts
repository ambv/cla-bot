import {
  Agreement,
  AgreementListItem,
  type AgreementsRepository,
  AgreementText,
  AgreementVersion,
} from "../domain/agreements";
import {inject, injectable} from "inversify";
import {
  InvalidArgumentError,
  NotFoundError,
  InvalidOperationError,
} from "../../service/common/web";
import {TYPES} from "../../constants/types";
import {ServerError} from "../common/app";

@injectable()
export class AgreementsHandler {
  @inject(TYPES.AgreementsRepository)
  private _repository: AgreementsRepository;

  async getAgreements(filter?: string): Promise<AgreementListItem[]> {
    if (filter === "complete") {
      return await this._repository.getCompleteAgreements();
    }

    return await this._repository.getAgreements();
  }

  async getAgreement(id: string): Promise<Agreement | null> {
    return await this._repository.getAgreement(id);
  }

  async getAgreementVersion(id: string): Promise<AgreementVersion | null> {
    return await this._repository.getAgreementVersion(id);
  }

  async updateAgreement(
    id: string,
    name: string,
    description: string
  ): Promise<void> {
    // TODO: check etag!! Disallow updating the entity if etag doesn't match

    if (!name)
      throw new InvalidArgumentError("Missing `name` input parameter.");

    await this._repository.updateAgreement(id, name, description);
  }

  private getAgreementTextByVersionAndCulture(
    version: AgreementVersion,
    culture: string
  ): AgreementText {
    const texts = version.texts;

    if (texts === undefined) {
      // Expected populated texts here: this must not happen here
      throw new ServerError("Missing texts property in agreement context.");
    }

    const text = texts.filter((item) => item.culture === culture)[0];
    return text || null;
  }

  async getAgreementTextByVersionIdAndCulture(
    versionId: string,
    culture: string
  ): Promise<AgreementText | null> {
    const version = await this._repository.getAgreementVersion(versionId);

    if (version === null) throw new NotFoundError();

    return this.getAgreementTextByVersionAndCulture(version, culture);
  }

  async updateAgreementTextByVersionIdAndCulture(
    versionId: string,
    culture: string,
    title: string,
    body: string
  ): Promise<void> {
    // TODO: check etag!! Disallow updating the entity if etag doesn't match
    // the one on the client side: more than one administrator might be
    // editing the same object at the same time

    if (!title)
      throw new InvalidArgumentError("Missing `title` input parameter.");

    if (!body)
      throw new InvalidArgumentError("Missing `body` input parameter.");

    const version = await this._repository.getAgreementVersion(versionId);

    if (version === null) throw new NotFoundError();

    if (version.draft === false)
      throw new InvalidOperationError(
        "Cannot update an agreement version that is no more a draft."
      );

    const text = this.getAgreementTextByVersionAndCulture(version, culture);

    if (text === null) {
      // TODO: create an agreement text entity associated with the
      // given version.

      // This feature is not necessary for the first version of the CLA-Bot,
      // since every new agreement and new clone is initialized with a text
      // for English language, and the first version of the application
      // only supports English.
      throw new Error("Not implemented");
    } else {
      // update existing
      await this._repository.updateAgreementText(text.id, title, body);
    }
  }

  async createAgreement(
    name: string,
    description?: string
  ): Promise<AgreementListItem> {
    return await this._repository.createAgreement(name, description);
  }

  /**
   * Returns the current agreement text for a given repository,
   * and a given culture.
   *
   * @param repositoryFullName
   * @param cultureCode
   */
  async getAgreementTextForRepository(
    repositoryFullName: string,
    cultureCode: string
  ): Promise<AgreementText> {
    const agreementText = await this._repository.getAgreementTextForRepository(
      repositoryFullName,
      cultureCode
    );

    if (agreementText == null) {
      throw new NotFoundError(
        `License not found: repository ${repositoryFullName} ${cultureCode}`
      );
    }

    return agreementText;
  }

  async getAgreementText(
    versionId: string,
    cultureCode: string
  ): Promise<AgreementText> {
    const agreementText = await this._repository.getAgreementText(
      versionId,
      cultureCode
    );

    if (agreementText == null) {
      throw new NotFoundError(
        `Agreement not found: version ${versionId} ${cultureCode}`
      );
    }

    return agreementText;
  }

  /**
   * Marks an agreement version with the given id as DONE
   * (non draft). Its texts cannot be edited after this operation.
   */
  async completeAgreementVersion(versionId: string): Promise<void> {
    const agreementVersion = await this._repository.getAgreementVersion(
      versionId
    );

    if (agreementVersion === null) throw new NotFoundError();

    await this._repository.updateAgreementVersion(versionId, false);
  }

  private readAgreementVersionParentId(version: AgreementVersion): string {
    const agreementId = version.agreementId;

    if (agreementId === undefined || agreementId === null)
      throw new ServerError("Missing parent id in version context.");

    return agreementId;
  }

  /**
   * Sets the agreement version with the given id as current.
   * All other versions for the parent agreement object become non-current.
   *
   * When an agreement version is set as current, its text
   * is displayed in CLA checks for repositories bound to the parent
   * agreement object.
   */
  async makeAgreementVersionCurrent(versionId: string): Promise<void> {
    const version = await this._repository.getAgreementVersion(versionId);

    if (version === null) throw new NotFoundError();

    if (version.draft)
      throw new InvalidOperationError(
        "Cannot set a draft version as current."
      );

    const agreementId = this.readAgreementVersionParentId(version);

    await this._repository.setCurrentAgreementVersion(agreementId, versionId);
  }

  /**
   * Clones an existing agreement version with the given id,
   * copying all its texts.
   *
   * @param versionId id of the version to copy
   * @param newVersionNumber number to associate with the cloned version
   */
  async cloneAgreementVersion(versionId: string): Promise<AgreementVersion> {
    const version = await this._repository.getAgreementVersion(versionId);

    if (version === null) throw new NotFoundError();

    const agreementId = this.readAgreementVersionParentId(version);

    if (version.texts === undefined) {
      throw new ServerError("Missing texts information");
    }

    return await this._repository.createAgreementVersion(
      agreementId,
      version.texts.map((existingText) => {
        return {
          title: existingText.title,
          text: existingText.text,
          culture: existingText.culture,
        };
      })
    );
  }
}
