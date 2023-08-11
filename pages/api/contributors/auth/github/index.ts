import githubAuth from "./configuration";
import {NextApiRequest, NextApiResponse} from "next";

export default (req: NextApiRequest, res: NextApiResponse) => {
  // redirects to GitHub login page to authorize our application
  const state = req.query.state;

  if (!state) {
    // A state context is required to recreate the PR and original poster ID
    res.status(400).end("Missing state context.");
    return;
  }

  if (Array.isArray(state)) {
    throw new Error(`Unexpected multiple "state=" parameters in callback URI`);
  }

  const signInUrl = new URL(githubAuth.code.getUri());
  signInUrl.searchParams.set("state", state);
  res.setHeader("Location", signInUrl.toString());
  res.status(302).end();
};
