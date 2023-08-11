import {inject, injectable} from "inversify";
import {TYPES} from "../../constants/types";
import type {
  Administrator,
  AdministratorsRepository,
} from "../domain/administrators";
import {BadRequestError, UnauthorizedError} from "../common/web";
import type {UsersService} from "../domain/users";
import {TokensHandler} from "./tokens";
import type {OrganizationsService} from "../domain/organizations";
import {ServiceSettings} from "../settings";

@injectable()
export class AdministratorsHandler {
  @inject(TYPES.ServiceSettings)
  private _settings: ServiceSettings;

  @inject(TYPES.AdministratorsRepository)
  private _repository: AdministratorsRepository;

  @inject(TYPES.UsersService) private _usersService: UsersService;

  @inject(TYPES.OrganizationsService)
  private _organizationsService: OrganizationsService;

  @inject(TYPES.TokensHandler) private _tokensHandler: TokensHandler;

  async getAdministrators(): Promise<Administrator[]> {
    return await this._repository.getAdministrators();
  }

  async addAdministrator(email: string): Promise<void> {
    if (!email || !email.trim()) throw new BadRequestError("Missing email");

    email = email.trim();

    // TODO: it would be nice to send an invitation email to new
    // administrators (out of the scope of the MVP)

    await this._repository.addAdministrator(email);
  }

  async removeAdministrator(id: string): Promise<void> {
    // TODO: an administrator cannot remove self

    // TODO: it would be appropriate to invalidate any open session
    // by marking JWTs as expired. This requires something like Redis,
    // we cannot validate the state of JWTs at each web request because it
    // kills performance and defeats the purpose of JWTs in the first place.
    // (Out of the scope of the MVP)

    if (!id || !id.trim()) throw new BadRequestError("Missing id");

    await this._repository.removeAdministrator(id);
  }

  /**
   * Validates an access token obtained after Sign-In through the OAuth
   * application, using the administrators endpoint.
   *
   * Note that anybody can do sign-in using the OAuth application: the business
   * logic here validates that the user who signed in using a GitHub account
   * is configured as administrator in the system.
   */
  async validateAdministratorLogin(accessToken: string): Promise<string> {
    // first try to authenticate the user by comparing its id with
    // organization members with admin role
    const userInfo = await this._usersService.getUserInfoFromAccessToken(
      accessToken
    );

    // is there an organization administrator with matching user id?
    const organizationMembers = await this._organizationsService.getMembers(
      this._settings.organizationName,
      "admin"
    );

    if (
      organizationMembers.some((item) => {
        return item.id === userInfo.id;
      })
    ) {
      // the person who just logged in is authorized because
      // administrator of the organization being handled
      return this._tokensHandler.createApplicationToken({
        id: userInfo.id,
        login: userInfo.login,
        email: null,
      });
    }

    // try to authenticate the user by email address and db configuration
    const userEmails = await this._usersService.getUserEmailAddresses(
      accessToken
    );

    // try first using the primary email
    const emailInfo = userEmails.find((item) => item.primary && item.verified);

    if (emailInfo === undefined) {
      throw new UnauthorizedError(
        "The user doesn't have a primary verified email."
      );
    }

    let admin = await this._repository.getAdministratorByEmail(
      emailInfo.email
    );

    if (admin === null) {
      // try with other verified emails
      const verifiedEmailsInfo = userEmails.filter(
        (item) => !item.primary && item.verified
      );

      for (const verifiedEmailInfo of verifiedEmailsInfo) {
        admin = await this._repository.getAdministratorByEmail(
          verifiedEmailInfo.email
        );

        if (admin !== null) {
          break;
        }
      }
    }

    if (admin === null) {
      // The user who signed-in is not an administrator, return Unauthorized
      // message
      throw new UnauthorizedError();
    }

    // Create a JWT: the CLA-Bot is both issuer and audience of its own
    // access tokens.
    // In the future, if we want to support different application roles,
    // we can extend the generated token with scopes (scp claim), and
    // extend the auth logic to validate user's rights on API endpoints.
    // For example, a user might have read only access to Signed CLAs,
    // with a scope: "Read.CLA", another to agreements with "Agreements.Read"
    return this._tokensHandler.createApplicationToken({
      id: userInfo.id,
      login: userInfo.login,
      email: emailInfo.email,
    });
  }
}
