import {NextApiRequest, NextApiResponse} from "next";
import {container} from "../../../service/di";
import {TYPES} from "../../../constants/types";
import {ClasImportOutput, ClasImportInput} from "../../../service/domain/cla";
import {ClasHandler} from "../../../service/handlers/clas";
import {createAPIHandler} from "../../../pages-common/apiHandler";

const clasHandler = container.get<ClasHandler>(TYPES.ClasHandler);

export default createAPIHandler({
  POST: async (
    req: NextApiRequest,
    res: NextApiResponse<ClasImportOutput>
  ) => {
    const data = req.body as ClasImportInput;

    const result = await clasHandler.importClas(data);
    res.status(200).json(result);
  },
});
