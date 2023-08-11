import * as crypto from "crypto";

import {ClaCheckHandler} from "../../../service/handlers/check-cla";
import {ClaCheckInput} from "../../../service/domain/cla";
import {TYPES} from "../../../constants/types";
import {NextApiRequest, NextApiResponse} from "next";
import {container} from "../../../service/di";
import * as bodyParser from "body-parser";
import * as httpErrors from "http-errors";
import {NextHandleFunction} from "connect";
import {createAPIHandler} from "../../../pages-common/apiHandler";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Handler for GitHub pull requests.
// It verifies that the user who is creating a PR signed the CLA,
// and posts a status check to the PR.
const claHandler = container.get<ClaCheckHandler>(TYPES.ClaCheckHandler);

export default createAPIHandler({
  POST: {
    noAuth: true,
    handler: async (req, res) => {
      try {
        await runMiddleware(
          req,
          res,
          bodyParser.json({type: "application/json", verify})
        );
      } catch (e) {
        if (httpErrors.isHttpError(e)) {
          res.status(e.statusCode).json({error: e.message});
          return;
        } else {
          throw e;
        }
      }

      try {
        await _handler(req, res);
      } catch (e) {
        res.status(400).json({error: "Webhook error"});
        return;
      }
    },
  },
});

function runMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  middleware: NextHandleFunction
): Promise<void> {
  return new Promise((resolve, reject) => {
    middleware(req, res, (result) =>
      result instanceof Error ? reject(result) : resolve(result)
    );
  });
}

function verify(
  req: NextApiRequest,
  res: NextApiResponse,
  buf: Buffer,
  enc: string
): void {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret === undefined || secret === "") {
    return;
  }

  let expectedSignature = req.headers["x-hub-signature-256"];
  if (!expectedSignature) {
    throw new Error("Missing required webhook signature.");
  }
  if (typeof expectedSignature !== "string") {
    throw new Error("Multiple webhook signature specified.");
  }
  if (!expectedSignature.startsWith("sha256=")) {
    throw new Error("Webhook signature must start with sha256=");
  }
  expectedSignature = expectedSignature.substring("sha256=".length);

  const expectedBuf = Buffer.from(expectedSignature, "hex");
  if (expectedBuf.length === 0) {
    throw new Error(
      "Webhook signature must contain only hexadecimal characters"
    );
  }
  const signature = crypto
    .createHmac("sha256", secret)
    .update(buf)
    .digest("hex");

  const computedBuf = Buffer.from(signature, "hex");

  if (
    expectedBuf.length !== computedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, computedBuf)
  ) {
    throw new Error("Webhook signature did not match.");
  }
}

async function _handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Next.js enforces lowercase header names
  const event = req.headers["x-github-event"];

  if (!event) {
    res.status(400).end("Missing X-GitHub-Event header");
    return;
  }

  switch (event) {
    case "ping":
      // sent when configuring a webhook
      res.status(200).end("Hi there!");
      return;
    case "pull_request":
      const {body} = req;

      const action = body.action;
      if (["opened", "reopened", "synchronize"].indexOf(action) === -1) {
        res
          .status(200)
          .end(`Doing nothing: the pull_request action is ${action}`);
        return;
      }

      const gitHubUserId = body?.pull_request?.user?.id;
      const pullRequestId = body?.pull_request?.id;
      const pullRequestNumber = body?.pull_request?.number;
      const pullRequestHeadSha = body?.pull_request?.head?.sha;
      const pullRequestUrl = body?.pull_request?.html_url;
      const targetRepositoryId = body?.repository?.id;
      const targetRepositoryOwnerId = body?.repository?.owner?.id;
      const targetRepositoryOwnerName = body?.repository?.owner?.login;
      const targetRepositoryFullName = body?.repository?.full_name;
      const targetRepositoryName = body?.repository?.name;

      if (
        !gitHubUserId ||
        !pullRequestId ||
        !pullRequestNumber ||
        !pullRequestHeadSha ||
        !pullRequestUrl ||
        !targetRepositoryId ||
        !targetRepositoryOwnerId ||
        !targetRepositoryOwnerName ||
        !targetRepositoryFullName ||
        !targetRepositoryName
      ) {
        res.status(400).end(`Expected a pull request webhook payload with:
          pull_request.number;
          pull_request.user.id;
          pull_request.url;
          pull_request.head.sha;
          repository.id;
          repository.owner.id;
          repository.owner.login;
          repository.full_name;
          repository.name;
        `);
        return;
      }

      if (Buffer.from(pullRequestHeadSha, "hex").length === 0) {
        res.status(400).end(`Invalid pull request HEAD SHA`);
        return;
      }

      const input: ClaCheckInput = {
        gitHubUserId,
        agreementVersionId: null,
        authors: null,
        pullRequest: {
          id: pullRequestId,
          number: pullRequestNumber,
          url: pullRequestUrl,
          headSha: pullRequestHeadSha,
        },
        repository: {
          id: targetRepositoryId,
          owner: targetRepositoryOwnerName,
          ownerId: targetRepositoryOwnerId,
          name: targetRepositoryName,
          fullName: targetRepositoryFullName,
        },
      };

      await claHandler.checkCla(input);
      res.status(200).end("OK");
      return;

    default:
      res.status(400).end(`The event ${event} is not handled.`);
      return;
  }
}
