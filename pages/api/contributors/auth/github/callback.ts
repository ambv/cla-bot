import githubAuth from "./configuration";
import {container} from "../../../../../service/di";
import {NextApiRequest, NextApiResponse} from "next";
import {SafeError} from "../../../../../service/common/web";
import {SignClaHandler} from "../../../../../service/handlers/sign-cla";
import {TYPES} from "../../../../../constants/types";
import {readOAuthError} from "../../../../../pages-common/oauth";

const signHandler = container.get<SignClaHandler>(TYPES.SignClaHandler);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  // This function handles an incoming HTTP request following an attempt
  // to sign in, or a redirect fired by GitHub in case of a configuration error
  const error = readOAuthError(req);

  if (error) {
    // this is most likely a configuration error on our side
    // however, this might happen if the end user modified by hand the GitHub
    // login page url (for example, modifying the redirect_uri)
    res.status(400).end(error);
    return;
  }

  const rawState = req.query.state;

  if (!rawState) {
    return res
      .status(400)
      .end(
        "Missing state context: expected information about original PR and the user " +
          "who created it."
      );
  }

  try {
    const requestUrl = req.url;

    if (!requestUrl) throw new Error("Missing request url.");

    const token = await githubAuth.code.getToken(requestUrl);
    const accessToken = token.accessToken;

    const result = await signHandler.signCla(rawState.toString(), accessToken);

    // redirect to the PR page
    res.setHeader("Location", result.redirectUrl);
    res.status(302).end("OK");
  } catch (error) {
    if (error instanceof SafeError) {
      res.status(error.statusCode).end(error.message);
      return;
    }

    throw error;
  }
};
