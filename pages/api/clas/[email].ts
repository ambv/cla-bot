import {container} from "../../../service/di";
import {NextApiRequest, NextApiResponse} from "next";
import {TYPES} from "../../../constants/types";
import {ClasHandler} from "../../../service/handlers/clas";
import {createAPIHandler} from "../../../pages-common/apiHandler";

const clasHandler = container.get<ClasHandler>(TYPES.ClasHandler);

export default createAPIHandler({
  GET: async (req: NextApiRequest, res: NextApiResponse) => {
    const {
      query: {email},
    } = req;

    if (typeof email !== "string") {
      // should never happen by definition
      res.status(400).end("Invalid email id");
      return;
    }

    const data = await clasHandler.getClaByEmail(email);

    if (!data) {
      res.status(404).end("Object not found.");
      return;
    }

    res.status(200).json(data);
  },
});
