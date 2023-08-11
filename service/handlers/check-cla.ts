import {async_retry} from "../common/resiliency";
import {
  CheckState,
  StatusCheckInput,
  type StatusChecksService,
} from "../../service/domain/checks";
import type {ClaCheckInput, ClaRepository} from "../../service/domain/cla";
import type {
  CommentsRepository,
  CommentsService,
} from "../../service/domain/comments";
import {inject, injectable} from "inversify";
import {type AgreementsRepository} from "../domain/agreements";
import {ServiceSettings} from "../settings";
import {TokensHandler} from "../handlers/tokens";
import {TYPES} from "../../constants/types";

export const CLA_CHECK_CONTEXT = "CLA Signing";
export const SUCCESS_MESSAGE = "The Contributor License Agreement is signed.";
export const FAILURE_MESSAGE =
  "Please sign our Contributor License Agreement.";

@injectable()
class ClaCheckHandler {
  @inject(TYPES.ServiceSettings) private _settings: ServiceSettings;
  @inject(TYPES.ClaRepository) private _claRepository: ClaRepository;

  @inject(TYPES.CommentsService)
  private _commentsService: CommentsService;

  @inject(TYPES.CommentsRepository)
  private _commentsRepository: CommentsRepository;

  @inject(TYPES.StatusChecksService)
  private _statusCheckService: StatusChecksService;

  @inject(TYPES.AgreementsRepository)
  private _agreementsRepository: AgreementsRepository;

  @inject(TYPES.TokensHandler)
  private _tokensHandler: TokensHandler;

  getTargetUrlWithChallenge(data: ClaCheckInput): string {
    // The target URL for the check must not only point to this instance of
    // the web application to the page that displays the license agreement,
    //
    // it must also include a `state` query string parameter that will be
    // handled through OAuth. The state is necessary to ensure that the same
    // person who opened the PR is the one who authorizes our app and does
    // sign-in to sign the agreement.

    // We create a JWT token, to ensure that the user cannot modify the
    // parameter
    const token = this._tokensHandler.createToken(data);
    /* tslint:disable-next-line */
    return `${this._settings.url}/contributor-license-agreement?state=${token}`;
  }

  getSignedComment(signedUrl: string): string {
    return (
      `All commit authors signed the Contributor License Agreement. <br/> ` +
      `[![CLA signed](${this._settings.url}/cla-signed.svg)](${signedUrl})`
    );
  }

  getNotSignedComment(challengeUrl: string, emails: string[]): string {
    let emailsFormatted = "";
    emails.sort();
    emails.forEach((email) => {
      emailsFormatted += `* ${email}\n`;
    });
    return (
      `The following commit authors need to sign the Contributor License Agreement:\n\n` +
      `${emailsFormatted}\n` +
      `Click the button to sign:<br/>` +
      `[![CLA not signed](${this._settings.url}/cla-not-signed.svg)](${challengeUrl})`
    );
  }

  private async addCommentWithNegativeStatus(
    data: ClaCheckInput,
    challengeUrl: string
  ): Promise<void> {
    // was a CLA comment for this PR already written?
    const commentInfo =
      await this._commentsRepository.getCommentInfoByPullRequestId(
        data.pullRequest.id
      );

    let emails: string[] = [];
    if (data.authors !== null) {
      emails = data.authors;
    }

    if (commentInfo != null) {
      // Make sure that the comment is updated with failure information,
      // because the comment might have an outdated positive message.
      // This scenario can happen if: someone first creates a PR and signs
      // the CLA, later asks to be removed from our database
      // (like GDPR in Europe), without completing this PR, finally closes
      // and reopens the PR

      await this._commentsService.updateComment(
        data.repository.ownerId,
        data.repository.fullName,
        commentInfo.commentId,
        this.getNotSignedComment(challengeUrl, emails)
      );
      return;
    }

    const commentId = await this._commentsService.createComment(
      data.repository.ownerId,
      data.repository.fullName,
      data.pullRequest.number,
      this.getNotSignedComment(challengeUrl, emails)
    );

    await this._commentsRepository.storeCommentInfo(
      commentId,
      data.pullRequest.id,
      new Date()
    );
  }

  async authorsWithoutCla(allAuthors: string[]): Promise<string[]> {
    const result: string[] = [];
    for (let i = 0; i < allAuthors.length; i++) {
      const email = allAuthors[i];

      const cla = await this._claRepository.getClaByEmailAddress(email);
      if (cla == null) {
        result.push(email);
      }
    }
    return result;
  }

  getSuccessStatusTargetUrl(versionId: string): string {
    // Note: the success status URL is not going to change over time,
    // but the license can change. Here we know that contributors signed
    // a certain version of the CLA, therefore we keep the version id in
    // the status URL: in the future we can display the exact license that
    // was signed at this point in time.
    return (
      `${this._settings.url}/signed-contributor-license-agreement` +
      `?version=${versionId}`
    );
  }

  private async completeClaCheck(
    data: ClaCheckInput,
    agreementVersionId: string
  ): Promise<void> {
    const statusUrl = this.getSuccessStatusTargetUrl(agreementVersionId);

    await this._statusCheckService.createStatus(
      data.repository.ownerId,
      data.repository.fullName,
      data.pullRequest.headSha,
      new StatusCheckInput(
        CheckState.success,
        statusUrl,
        SUCCESS_MESSAGE,
        CLA_CHECK_CONTEXT
      )
    );

    // if a comment was created, update its text;
    const repository = this._commentsRepository;
    const commentInfo = await repository.getCommentInfoByPullRequestId(
      data.pullRequest.id
    );

    if (commentInfo == null) {
      return;
    }

    await this._commentsService.updateComment(
      data.repository.ownerId,
      data.repository.fullName,
      commentInfo.commentId,
      this.getSignedComment(statusUrl)
    );
  }

  async readAgreementVersionId(data: ClaCheckInput): Promise<string> {
    if (data.agreementVersionId) {
      return data.agreementVersionId;
    }

    const currentAgreementForRepository =
      await this._agreementsRepository.getCurrentAgreementVersionForRepository(
        data.repository.fullName
      );

    if (!currentAgreementForRepository) {
      throw new Error("Missing license version ID in state");
    }

    return currentAgreementForRepository.versionId;
  }

  @async_retry()
  async checkCla(data: ClaCheckInput): Promise<void> {
    // Is an agreement configured for the PR repository?
    // if not, there is no need to do a check for CLA signing
    let agreementVersionId = "";
    try {
      agreementVersionId = await this.readAgreementVersionId(data);
    } catch (error) {
      return;
    }

    const allAuthors =
      await this._statusCheckService.getAllAuthorsByPullRequestId(
        data.repository.fullName,
        data.pullRequest.number,
        this._settings.preApprovedAccounts
      );

    let emailsWithoutCla: string[] = [];
    let challengeUrl = "";
    if (allAuthors.length) {
      // Store authors in the input state, so we don't need to fetch
      // again the same information when validating each author
      // (when each of them authorizes our app);
      data.authors = await this.authorsWithoutCla(allAuthors);
      challengeUrl = this.getTargetUrlWithChallenge(data);
      emailsWithoutCla = data.authors;
    }

    if (!emailsWithoutCla.length) {
      await this.completeClaCheck(data, agreementVersionId);
    } else {
      await this._statusCheckService.createStatus(
        data.repository.ownerId,
        data.repository.fullName,
        data.pullRequest.headSha,
        new StatusCheckInput(
          CheckState.failure,
          challengeUrl,
          FAILURE_MESSAGE,
          CLA_CHECK_CONTEXT
        )
      );

      // add a comment to increase visibility
      await this.addCommentWithNegativeStatus(data, challengeUrl);
    }
  }
}

export {ClaCheckHandler};
