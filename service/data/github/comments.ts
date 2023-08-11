import {async_retry} from "../../common/resiliency";
import {CommentsService} from "../../domain/comments";
import {expectSuccessfulResponse} from "../../common/web";
import {accessHandler, GitHubAccessHandler} from "./clientcredentials";
import {getHeadersForJsonContent} from "./headers";
import {injectable} from "inversify";

interface CratedCommentOutput {
  id: string;
}

@injectable()
export class GitHubCommentsService implements CommentsService {
  private _access_token_handler: GitHubAccessHandler;

  public constructor() {
    this._access_token_handler = accessHandler;
  }

  @async_retry()
  async createComment(
    targetAccountId: number,
    targetRepoFullName: string,
    issueId: number,
    body: string
  ): Promise<string> {
    const accessToken =
      await this._access_token_handler.getAccessTokenForAccount(
        targetAccountId
      );

    const response = await fetch(
      `https://api.github.com/repos/${targetRepoFullName}/issues/${issueId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({body}),
        headers: getHeadersForJsonContent(accessToken),
      }
    );

    await expectSuccessfulResponse(response);

    const data: CratedCommentOutput = await response.json();
    return data.id.toString();
  }

  @async_retry()
  async updateComment(
    targetAccountId: number,
    targetRepoFullName: string,
    commentId: string,
    body: string
  ): Promise<void> {
    const accessToken =
      await this._access_token_handler.getAccessTokenForAccount(
        targetAccountId
      );

    const response = await fetch(
      `https://api.github.com/repos/${targetRepoFullName}/issues/comments/${commentId}`,
      {
        method: "PATCH",
        body: JSON.stringify({body}),
        headers: getHeadersForJsonContent(accessToken),
      }
    );

    await expectSuccessfulResponse(response);
  }
}
