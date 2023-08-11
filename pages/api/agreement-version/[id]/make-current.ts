import {container} from "../../../../service/di";
import {AgreementsHandler} from "../../../../service/handlers/agreements";
import {NextApiRequest, NextApiResponse} from "next";
import {TYPES} from "../../../../constants/types";
import {createAPIHandler} from "../../../../pages-common/apiHandler";

const agreementsHandler = container.get<AgreementsHandler>(
  TYPES.AgreementsHandler
);

export default createAPIHandler({
  POST: async (req: NextApiRequest, res: NextApiResponse) => {
    const {
      query: {id},
    } = req;

    if (typeof id !== "string") {
      // should never happen by definition
      res.status(400).end("Invalid object id");
      return;
    }

    // updates the text of an existing agreement version
    // id is a version id;
    await agreementsHandler.makeAgreementVersionCurrent(id);
    res.status(204).end();
  },
});
