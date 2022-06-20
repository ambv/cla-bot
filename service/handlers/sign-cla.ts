import {async_retry} from "../common/resiliency";
import {StatusChecksService} from "../../service/domain/checks";
import {
  ContributorLicenseAgreement,
  ClaCheckInput,
  ClaRepository,
} from "../../service/domain/cla";
import {ClaCheckHandler} from "./check-cla";
import {
  CommentsRepository,
  CommentsService,
} from "../../service/domain/comments";
import {EmailInfo, UsersService} from "../../service/domain/users";
import {inject, injectable} from "inversify";
import {SafeError} from "../common/web";
import {TokensHandler} from "./tokens";
import {TYPES} from "../../constants/types";
import {v4 as uuid} from "uuid";

export interface SignedClaOutput {
  redirectUrl: string;
}

@injectable()
class SignClaHandler {
  @inject(TYPES.UsersService) private _usersService: UsersService;
  @inject(TYPES.ClaRepository) private _claRepository: ClaRepository;
  @inject(TYPES.ClaCheckHandler) private _claCheckHandler: ClaCheckHandler;
  @inject(TYPES.CommentsRepository)
  private _commentsRepository: CommentsRepository;
  @inject(TYPES.StatusChecksService)
  private _statusCheckService: StatusChecksService;
  @inject(TYPES.TokensHandler) private _tokensHandler: TokensHandler;

  parseState(rawState: string): ClaCheckInput {
    return this._tokensHandler.parseToken(rawState) as ClaCheckInput;
  }

  @async_retry()
  async createCla(
    username: string,
    emailInfo: EmailInfo,
    agreementVersionId: string
  ): Promise<ContributorLicenseAgreement> {
    const cla = new ContributorLicenseAgreement(
      uuid(),
      emailInfo.email.toString(),
      username,
      agreementVersionId,
      new Date()
    );

    await this._claRepository.saveCla(cla);
    return cla;
  }

  private getAllAuthors(data: ClaCheckInput): string[] {
    if (data.authors) {
      return data.authors.map(email => email.toLowerCase());
    }

    throw new Error("Missing authors information in state.");
  }

  private getAllMatchingEmails(
    authors: string[],
    userEmails: EmailInfo[]
  ): EmailInfo[] {
    return userEmails.filter((emailInfo) => {
      if (!emailInfo.email) {
        // this should never happen
        return false;
      }

      return authors.indexOf(emailInfo.email.toLowerCase()) > -1;
    });
  }

  private ensureThatEmailIsVerified(emailInfo: EmailInfo): void {
    if (emailInfo.verified === false) {
      throw new SafeError(
        `Email address: ${emailInfo.email} is not verified. ` +
          `Please verify your email address and try again.`
      );
    }
  }

  private async handleAllMatchingEmails(
    username: string,
    matchingEmails: EmailInfo[],
    agreementVersionId: string
  ): Promise<void> {
    for (let i = 0; i < matchingEmails.length; i++) {
      const matchingEmail = matchingEmails[i];

      this.ensureThatEmailIsVerified(matchingEmail);

      // did the user already sign the CLA with this email address?
      const existingCla = await this._claRepository.getClaByEmailAddress(
        matchingEmail.email.toLowerCase()
      );

      if (existingCla == null) {
        await this.createCla(username, matchingEmail, agreementVersionId);
      }
    }
  }

  async signCla(
    rawState: string,
    accessToken: string
  ): Promise<SignedClaOutput> {
    //
    // A user just signed-in, after authorizing the OAuth
    // app that can read email addresses.
    //
    // This method handles the unlikely scenario of a single user committing
    // using several email addresses, and being owner of all of them.
    //
    const data = this.parseState(rawState);
    const authors = this.getAllAuthors(data);
    const user = await this._usersService.getUserInfoFromAccessToken(
      accessToken
    );
    const userEmails = await this._usersService.getUserEmailAddresses(
      accessToken
    );

    const matchingEmails = this.getAllMatchingEmails(authors, userEmails);

    if (!matchingEmails.length) {
      // The user who signed in is not among those who contributed to the PR
      // NB: private email address *are* passed in `getUserEmailAddresses`
      // as well. Same for the pseudo-emails Github provides for each user
      // in the form 12345678+USERNAME@users.noreply.github.com.
      throw new SafeError(
        `Thank you for authorizing our application, but the CLA must be signed ` +
          `by the users who contributed to the PR. ` +
          `Authors emails are: ${authors}.`
      );
    }

    const handler = this._claCheckHandler;
    const agreementVersionId = await handler.readAgreementVersionId(data);

    await this.handleAllMatchingEmails(
      user.login,
      matchingEmails,
      agreementVersionId
    );

    await handler.checkCla(data);

    return {
      redirectUrl: data.pullRequest.url,
    };
  }
}

export {SignClaHandler};
