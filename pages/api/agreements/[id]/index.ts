import {AgreementsHandler} from "../../../../service/handlers/agreements";
import {container} from "../../../../service/di";
import {NextApiRequest, NextApiResponse} from "next";
import {TYPES} from "../../../../constants/types";
import {createAPIHandler} from "../../../../pages-common/apiHandler";

const agreementsHandler = container.get<AgreementsHandler>(
  TYPES.AgreementsHandler
);

export default createAPIHandler({
  GET: {
    noAuth: true,
    handler: async (req: NextApiRequest, res: NextApiResponse) => {
      const {
        query: {id},
      } = req;

      if (typeof id !== "string") {
        // should never happen by definition
        res.status(400).end("Invalid object id");
        return;
      }

      const data = await agreementsHandler.getAgreement(id);

      if (data === null) {
        res.status(404).json({
          error: "Agreement not found",
          errorCode: "NotFound",
        });
        return;
      }

      res.status(200).json(data);
    },
  },
  PATCH: async (req, res) => {
    const {
      query: {id},
    } = req;

    if (typeof id !== "string") {
      // should never happen by definition
      res.status(400).end("Invalid object id");
      return;
    }

    const body = req.body;

    await agreementsHandler.updateAgreement(id, body.name, body.description);

    res.status(204).end();
  },
});
