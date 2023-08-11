import e from "../../../dbschema/edgeql-js";

import {CommentInfo, CommentsRepository} from "../../domain/comments";
import {EdgeDBRepository} from "./base";
import {injectable} from "inversify";

@injectable()
export class EdgeDBCommentsRepository
  extends EdgeDBRepository
  implements CommentsRepository
{
  async getCommentInfoByPullRequestId(
    pullRequestId: number
  ): Promise<CommentInfo | null> {
    return await this.run(async (connection) =>
      e
        .select(e.CommentInfo, (c) => ({
          id: true,
          commentId: c.comment_id,
          pullRequestId: c.pull_request_id,
          createdAt: c.creation_time,

          filter_single: {pull_request_id: pullRequestId},
        }))
        .run(connection)
    );
  }

  async storeCommentInfo(
    commentId: string,
    pullRequestId: number,
    createdAt: Date
  ): Promise<void> {
    await this.run(async (connection) =>
      e
        .insert(e.CommentInfo, {
          comment_id: commentId,
          pull_request_id: pullRequestId,
          creation_time: createdAt,
        })
        .run(connection)
    );
  }
}
