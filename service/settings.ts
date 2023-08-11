import {getEnvSettingOrThrow, getEnvSettingOrDefault} from "./common/settings";
import {injectable} from "inversify";

/**
 * Common service settings, not specific to an external service.
 */
@injectable()
export class ServiceSettings {
  private _url: string;
  private _secret: string;
  private _organizationName: string;
  private _organizationDisplayName: string;
  private _preApprovedAccounts: string[];

  public get url(): string {
    return this._url;
  }

  public get secret(): string {
    return this._secret;
  }

  public get organizationName(): string {
    return this._organizationName;
  }

  public get organizationDisplayName(): string {
    return this._organizationDisplayName;
  }

  public get preApprovedAccounts(): string[] {
    return this._preApprovedAccounts;
  }

  constructor(serverUrl?: string, secret?: string, organizationName?: string) {
    this._url = serverUrl || getEnvSettingOrThrow("SERVER_URL");
    this._secret = secret || getEnvSettingOrThrow("SECRET");
    this._organizationName =
      organizationName || getEnvSettingOrThrow("ORGANIZATION_NAME");
    this._organizationDisplayName = getEnvSettingOrDefault(
      "ORGANIZATION_DISPLAY_NAME",
      this._organizationName
    );
    this._preApprovedAccounts = getEnvSettingOrDefault(
      "PREAPPROVED_GITHUB_ACCOUNTS",
      ""
    ).split(",");
  }
}
