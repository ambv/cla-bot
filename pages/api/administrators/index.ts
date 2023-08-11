import {container} from "../../../service/di";
import {TYPES} from "../../../constants/types";
import {AdministratorsHandler} from "../../../service/handlers/administrators";
import {createAPIHandler} from "../../../pages-common/apiHandler";

const administratorsHandler = container.get<AdministratorsHandler>(
  TYPES.AdministratorsHandler
);

export default createAPIHandler({
  GET: async (req, res) => {
    const items = await administratorsHandler.getAdministrators();
    res.status(200).json(items);
  },
  POST: async (req, res) => {
    const {email} = req.body;

    await administratorsHandler.addAdministrator(email);
    res.status(204).end();
  },
});
