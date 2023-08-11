import {async_retry} from "../../common/resiliency";
import {EmailInfo, UserInfo, UsersService} from "../../domain/users";
import {expectSuccessfulResponse} from "../../common/web";
import {fetchAllItems} from "./utils";
import {injectable} from "inversify";

@injectable()
export class GitHubUsersService implements UsersService {
  @async_retry()
  async getUserInfoFromAccessToken(accessToken: string): Promise<UserInfo> {
    const response = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });

    await expectSuccessfulResponse(response);
    return (await response.json()) as UserInfo;
  }

  async getUserEmailAddresses(accessToken: string): Promise<EmailInfo[]> {
    return await fetchAllItems("https://api.github.com/user/emails", {
      method: "GET",
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });
  }
}
