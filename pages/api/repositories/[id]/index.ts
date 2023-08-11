import {container} from "../../../../service/di";
import {TYPES} from "../../../../constants/types";
import {RepositoriesHandler} from "../../../../service/handlers/repositories";
import {createAPIHandler} from "../../../../pages-common/apiHandler";

const repositoriesHandler = container.get<RepositoriesHandler>(
  TYPES.RepositoriesHandler
);

export default createAPIHandler({
  DELETE: async (req, res) => {
    const {
      query: {id},
    } = req;

    if (typeof id !== "string") {
      // should never happen by definition
      res.status(400).end("Invalid object id");
      return;
    }

    await repositoriesHandler.deleteRepositoryConfiguration(id);

    res.status(204).end();
  },
});
