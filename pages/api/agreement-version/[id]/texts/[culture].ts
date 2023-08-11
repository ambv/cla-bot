import {container} from "../../../../../service/di";
import {AgreementsHandler} from "../../../../../service/handlers/agreements";
import {NextApiRequest, NextApiResponse} from "next";
import {TYPES} from "../../../../../constants/types";
import {createAPIHandler} from "../../../../../pages-common/apiHandler";

const agreementsHandler = container.get<AgreementsHandler>(
  TYPES.AgreementsHandler
);

function parseQueryParams(
  req: NextApiRequest,
  res: NextApiResponse
): {id: string; culture: string} | void {
  const {
    query: {id, culture},
  } = req;

  if (typeof id !== "string") {
    // should never happen by definition
    res.status(400).end("Invalid object id");
    return;
  }

  if (typeof culture !== "string") {
    // should never happen by definition
    res.status(400).end("Invalid culture code");
    return;
  }

  return {id, culture};
}

export default createAPIHandler({
  GET: {
    noAuth: true,
    handler: async (req: NextApiRequest, res: NextApiResponse) => {
      const params = parseQueryParams(req, res);

      if (!params) {
        return;
      }

      const data =
        await agreementsHandler.getAgreementTextByVersionIdAndCulture(
          params.id,
          params.culture
        );

      if (!data) {
        res.status(404).end("Agreement text not found.");
        return;
      }

      res.status(200).json(data);
    },
  },
  PUT: async (req: NextApiRequest, res: NextApiResponse) => {
    const params = parseQueryParams(req, res);

    if (!params) {
      return;
    }

    const body = req.body;

    // inserts or updates the text of an existing agreement version
    // by id and culture: id is a version id
    await agreementsHandler.updateAgreementTextByVersionIdAndCulture(
      params.id,
      params.culture,
      body.title,
      body.text
    );
    res.status(204).end();
  },
});
