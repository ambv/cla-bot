import githubAuth from "./configuration";
import {NextApiRequest, NextApiResponse} from "next";
import {readOAuthError} from "../../../../../pages-common/oauth";
import {AdministratorsHandler} from "../../../../../service/handlers/administrators";
import {container} from "../../../../../service/di";
import {TYPES} from "../../../../../constants/types";
import {handleExceptions} from "../../../../../pages-common/handleExceptions";

const administratorsHandler = container.get<AdministratorsHandler>(
  TYPES.AdministratorsHandler
);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  // This function handles an incoming HTTP request following an attempt
  // to sign in, or a redirect fired by GitHub in case of a configuration error
  const error = readOAuthError(req);

  if (error) {
    // This is most likely a configuration error on our side,
    // however, this might happen if the end user modified by hand the GitHub
    // login page url (for example, modifying the redirect_uri)
    res.status(400).end(error);
    return;
  }

  const requestUrl = req.url;

  if (!requestUrl) throw new Error("Missing request url.");

  const token = await githubAuth.code.getToken(requestUrl);
  const accessToken = token.accessToken;

  // Verify that the user is an administrator
  // issue an access token for the user, to be used on the client,
  // redirect to admin page

  await handleExceptions(res, async () => {
    const result = await administratorsHandler.validateAdministratorLogin(
      accessToken
    );

    // Redirect to a page that sets the access token to the session
    // storage, then redirects to the admin page
    res.writeHead(302, {
      Location: `/admin/after-login?access_token=${result}`,
    });
    res.end();
  });
};
