import {NextApiRequest, NextApiResponse} from "next";
import {container} from "../../../service/di";
import {AgreementsHandler} from "../../../service/handlers/agreements";
import {TYPES} from "../../../constants/types";
import {ServerError} from "../../../service/common/app";
import {createAPIHandler} from "../../../pages-common/apiHandler";

interface SignedAgreement {
  title: string;
  text: string;
}

// Returns the text of an already signed agreement

export default createAPIHandler({
  GET: {
    noAuth: true,
    handler: async (
      req: NextApiRequest,
      res: NextApiResponse<SignedAgreement>
    ) => {
      const versionId = req.query.version;

      if (typeof versionId !== "string") {
        res.status(400).end("Missing version parameter");
        return;
      }

      const licensesHandler = container.get<AgreementsHandler>(
        TYPES.AgreementsHandler
      );

      const agreementText = await licensesHandler.getAgreementText(
        versionId,
        "en"
      );

      if (agreementText.versionId === null) {
        // We need the agreement version id here,
        // for the reason described below
        throw new ServerError("Missing version id in agreement text context.");
      }

      res.status(200).json({
        text: agreementText.text,
        title: agreementText.title,
      });
    },
  },
});
