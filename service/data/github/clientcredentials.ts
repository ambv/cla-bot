import fs from "fs";
import jwt from "jsonwebtoken";
import {async_retry} from "../../common/resiliency";
import {getHeaders} from "./headers";
import {expectSuccessfulResponse} from "../../common/web";

export class InstallationNotFoundError extends Error {
  constructor(targetAccountId: number) {
    super(`An installation for target account ${targetAccountId} was not found. Is
    the GitHub application authorized to interact with the desired GitHub account?`);
  }
}

interface GitHubAppOwner {
  login: string;
  id: number;
  type: string;
}

interface GitHubApp {
  id: number;
  slug: string;
  owner: GitHubAppOwner;
}

interface GitHubInstallationAccessTokenResult {
  token: string;
  expires_at: string;
  permissions: {[key: string]: string};
  repository_selection: string;
}

// GitHub api returns much more information,
// but here we care only about the following:
interface GitHubInstallationItem {
  id: number;
  target_id: number;
}

interface AccessToken {
  value: string;
  expiresAt: number;
}

export class GitHubAccessHandler {
  // This class handles client credentials flow to obtain access tokens
  // to interact with our own organization

  private _privateKey: Buffer;
  private _githubApplicationId: number;
  private _accountAccessTokensCache: {[accountId: number]: AccessToken};

  constructor() {
    this._privateKey = this.getPrivateKey();
    this._githubApplicationId = this.getGitHubApplicationId();
    this._accountAccessTokensCache = {};
  }

  private getPrivateKeyPath(): string {
    const privateRsaKeyPath = process.env.GITHUB_RSA_PRIVATE_KEY_FILE;

    if (!privateRsaKeyPath) {
      throw new Error(
        "Missing GITHUB_RSA_PRIVATE_KEY_FILE environmental variable: " +
          "it must contain the path to a private RSA key used to generate JWTs"
      );
    }
    return privateRsaKeyPath;
  }

  private getGitHubApplicationId(): number {
    const githubApplicationIdRaw = process.env.GITHUB_APPLICATION_ID;

    if (!githubApplicationIdRaw) {
      throw new Error(
        "Missing GITHUB_APPLICATION_ID environmental variable: " +
          "it must contain the id of the GitHub application with organization rights."
      );
    }

    const githubApplicationId = parseInt(githubApplicationIdRaw, 10);

    if (isNaN(githubApplicationId)) {
      throw new Error(
        `Invalid GITHUB_APPLICATION_ID environmental variable: {githubApplicationIdRaw}` +
          "it must contain the id of the GitHub application with organization rights."
      );
    }
    return githubApplicationId;
  }

  private getPrivateKey(): Buffer {
    return fs.readFileSync(this.getPrivateKeyPath());
  }

  createPrimaryAccessToken(): string {
    // TODO: access tokens can be cached in memory until they expire
    // this is low priority since creating a new access token here is cheap
    const time = Math.round(new Date().getTime() / 1000);

    return jwt.sign(
      {
        iat: time,
        exp: time + 9 * 60,
        iss: `${this._githubApplicationId}`,
      },
      this._privateKey,
      {algorithm: "RS256"}
    );
  }

  setCachedAccessToken(targetAccountId: number, token: AccessToken): void {
    this._accountAccessTokensCache[targetAccountId] = token;
  }

  getCachedAccessToken(targetAccountId: number): AccessToken | null {
    if (targetAccountId in this._accountAccessTokensCache) {
      const cachedAccessToken =
        this._accountAccessTokensCache[targetAccountId];

      // applies a margin of 60 seconds while checking for expiration
      if (new Date().getTime() + 60000 < cachedAccessToken.expiresAt) {
        // reusing a cached access token
        return cachedAccessToken;
      }

      // remove the expired access token
      delete this._accountAccessTokensCache[targetAccountId];
    }
    return null;
  }

  private async getInstallationIdByAccountId(
    targetAccountId: number,
    primaryAccessToken: string
  ): Promise<number> {
    const response = await fetch("https://api.github.com/app/installations", {
      method: "GET",
      headers: getHeaders(primaryAccessToken),
    });

    await expectSuccessfulResponse(response);

    const data: GitHubInstallationItem[] = await response.json();
    let installationId: number | null = null;

    data.forEach((installation) => {
      if (installation.target_id === targetAccountId) {
        installationId = installation.id;
      }
    });

    if (installationId == null)
      throw new InstallationNotFoundError(targetAccountId);

    return installationId;
  }

  /**
   * Obtains the ID of the GitHub application organization.
   * This assumes that the CLA-Bot is created for an Organization.
   */
  @async_retry()
  async getApplicationOrganizationId(
    primaryAccessToken?: string
  ): Promise<number> {
    if (!primaryAccessToken)
      primaryAccessToken = this.createPrimaryAccessToken();

    const response = await fetch("https://api.github.com/app", {
      method: "GET",
      headers: getHeaders(primaryAccessToken),
    });

    await expectSuccessfulResponse(response);

    const data: GitHubApp = await response.json();
    return data.owner.id;
  }

  @async_retry()
  async getOrgAccessToken(primaryAccessToken?: string): Promise<string> {
    if (!primaryAccessToken)
      primaryAccessToken = this.createPrimaryAccessToken();

    const organizationId = await this.getApplicationOrganizationId(
      primaryAccessToken
    );
    return await this.getAccessTokenForAccount(
      organizationId,
      primaryAccessToken
    );
  }

  @async_retry()
  async getAccessTokenForAccount(
    targetAccountId: number,
    primaryAccessToken?: string
  ): Promise<string> {
    // To get an access token for a GitHub app to interact with a repository,
    // it is necessary to obtain first the "installation id", which represents
    // the authorization of the GitHub app over the target account, and then
    // obtain an access token for the installation.
    // It is possible that a GitHub app has access rights over a different
    // repository, but here for simplicity we don't verify if the app is
    // authorized on the repository on which the PR is being done.
    // A call to this API:
    // https://api.github.com/installation/repositories
    // would enable to follow "look before you leap"

    // installation access tokens issued by GitHub last one hour, so we
    // cache them in memory and reuse them if possible
    const cachedAccessToken = this.getCachedAccessToken(targetAccountId);

    if (cachedAccessToken !== null) {
      return cachedAccessToken.value;
    }

    if (!primaryAccessToken)
      primaryAccessToken = this.createPrimaryAccessToken();

    const installationId = await this.getInstallationIdByAccountId(
      targetAccountId,
      primaryAccessToken
    );

    // tslint:disable-next-line: max-line-length
    const installationAccessTokenResult =
      await this.getAccessTokenForInstallation(installationId);

    this.setCachedAccessToken(targetAccountId, {
      value: installationAccessTokenResult.token,
      expiresAt: new Date(installationAccessTokenResult.expires_at).getTime(),
    });

    return installationAccessTokenResult.token;
  }

  @async_retry()
  async getAccessTokenForInstallation(
    installationId: number,
    primaryAccessToken?: string
  ): Promise<GitHubInstallationAccessTokenResult> {
    // An installation, in GitHub terminology, refers to a GitHub app
    // being authorized over a certain organization.
    // To interact with repositories inside an organization, we
    // need an access token issued for the installation.
    // https://api.github.com/app/installations

    if (!primaryAccessToken)
      primaryAccessToken = this.createPrimaryAccessToken();

    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: getHeaders(primaryAccessToken),
      }
    );

    await expectSuccessfulResponse(response);

    const data: GitHubInstallationAccessTokenResult = await response.json();
    return data;
  }
}

const accessHandler = new GitHubAccessHandler();

export {accessHandler};
