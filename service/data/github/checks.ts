import {accessHandler, GitHubAccessHandler} from "./clientcredentials";
import {async_retry} from "../../common/resiliency";
import {
  CheckState,
  StatusCheckInput,
  StatusChecksService,
} from "../../domain/checks";
import {expectSuccessfulResponse} from "../../common/web";
import {getHeadersForJsonContent} from "./headers";
import {hasMoreItems} from "./utils";
import {injectable} from "inversify";

interface GitHubPersonInfo {
  name: string;
  email: string;
  date: string;
}

interface GitHubCommitInfo {
  author: GitHubPersonInfo;
  committer: GitHubPersonInfo;
  message: string;
  url: string;
}

interface GitHubLoginInfo {
  login: string;
}

interface GitHubCommitItem {
  sha: string;
  node_id: string;
  commit: GitHubCommitInfo;
  url: string;
  html_url: string;
  author: GitHubLoginInfo;
  committer: GitHubLoginInfo;
}

@injectable()
export class GitHubStatusChecksAPI implements StatusChecksService {
  private _access_token_handler: GitHubAccessHandler;

  public constructor() {
    this._access_token_handler = accessHandler;
  }

  @async_retry()
  async getAllAuthorsByPullRequestId(
    targetRepoFullName: string,
    pullRequestNumber: number,
    preApprovedAccounts: string[]
  ): Promise<string[]> {
    let pageNumber = 0;
    const authorsEmails = new Set<string>();

    // GitHub returns commits in pages of 30 items;
    // we have two ways to know when we should stop fetching commits:
    // either do a call to get PR infor and see how many "commits" were done
    // or make web requests increasing the page until the
    while (true) {
      const response = await fetch(
        `https://api.github.com/repos/${targetRepoFullName}/pulls/${pullRequestNumber}/commits?page=${pageNumber}`
      );

      await expectSuccessfulResponse(response);

      const data: GitHubCommitItem[] = await response.json();

      data.forEach((item) => {
        if (
          !(item.author && preApprovedAccounts.includes(item.author.login))
        ) {
          authorsEmails.add(item.commit.author.email);
        }
      });

      if (!data.length || !hasMoreItems(response)) {
        break;
      }

      pageNumber += 1;
    }

    return Array.from(authorsEmails);
  }

  @async_retry()
  async createStatus(
    targetAccountId: number,
    targetRepoFullName: string,
    pullRequestHeadSha: string,
    data: StatusCheckInput
  ): Promise<void> {
    const accessToken =
      await this._access_token_handler.getAccessTokenForAccount(
        targetAccountId
      );

    const response = await fetch(
      `https://api.github.com/repos/${targetRepoFullName}/statuses/${pullRequestHeadSha}`,
      {
        method: "POST",
        body: JSON.stringify({
          state: CheckState[data.state],
          target_url: data.targetUrl,
          description: data.description,
          context: data.context,
        }),
        headers: getHeadersForJsonContent(accessToken),
      }
    );

    await expectSuccessfulResponse(response);
  }
}
