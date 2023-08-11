import ClientOAuth2 from "client-oauth2";
import {getEnvSettingOrThrow} from "../../../../../service/common/settings";

const OWN_SERVER_BASE_URL = getEnvSettingOrThrow("SERVER_URL");

export default new ClientOAuth2({
  clientId: getEnvSettingOrThrow("GITHUB_OAUTH_APPLICATION_ID"),
  clientSecret: getEnvSettingOrThrow("GITHUB_OAUTH_APPLICATION_SECRET"),
  accessTokenUri: "https://github.com/login/oauth/access_token",
  authorizationUri: "https://github.com/login/oauth/authorize",
  /* tslint:disable-next-line */
  redirectUri: `${OWN_SERVER_BASE_URL}/api/administrators/auth/github/callback`,
  scopes: ["profile", "user:email"],
});
