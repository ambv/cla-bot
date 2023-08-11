import {NextApiRequest, NextApiResponse} from "next";
import {container} from "../../../service/di";
import {TokensHandler} from "../../../service/handlers/tokens";
import {AgreementsHandler} from "../../../service/handlers/agreements";
import {TYPES} from "../../../constants/types";
import {ClaCheckInput} from "../../../service/domain/cla";
import {ServerError} from "../../../service/common/app";
import {createAPIHandler} from "../../../pages-common/apiHandler";

interface ContributorLicenseAgreement {
  state: string;
  title: string;
  text: string;
}

// Returns a contributor license agreement text by state parameter
export default createAPIHandler({
  GET: {
    noAuth: true,
    handler: async (
      req: NextApiRequest,
      res: NextApiResponse<ContributorLicenseAgreement>
    ) => {
      const rawState = req.query.state;

      if (typeof rawState !== "string") {
        res.status(400).end("Missing state parameter");
        return;
      }

      const tokensHandler = container.get<TokensHandler>(TYPES.TokensHandler);
      const licensesHandler = container.get<AgreementsHandler>(
        TYPES.AgreementsHandler
      );

      const state = tokensHandler.parseToken(rawState) as ClaCheckInput;

      // Read the current agreement for the PR repository
      // Note: the page always fetches the current agreement text, regardless
      // of thte time when the PR was created.
      const agreementText =
        await licensesHandler.getAgreementTextForRepository(
          state.repository.fullName,
          "en"
        );

      if (agreementText.versionId === null) {
        // We need the agreement version id here,
        // for the reason described below
        throw new ServerError("Missing version id in agreement text context.");
      }

      state.agreementVersionId = agreementText.versionId;

      // Modify the state parameter to include the version id:
      // this ensures that we store the right version id when the user signs in
      // to agree
      res.status(200).json({
        state: tokensHandler.createToken(state),
        text: agreementText.text,
        title: agreementText.title,
      });
    },
  },
});
