import {NextApiRequest, NextApiResponse} from "next";
import {handleExceptions} from "./handleExceptions";
import {AuthContext, readJWTBearer} from "./auth";

type APIHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

type MethodHandler = APIHandler | {handler: APIHandler; noAuth?: boolean};

export function createAPIHandler(methodHandlers: {
  GET?: MethodHandler;
  POST?: MethodHandler;
  PATCH?: MethodHandler;
  PUT?: MethodHandler;
  DELETE?: MethodHandler;
}): APIHandler {
  const handlers: {[key: string]: {handler: APIHandler; noAuth: boolean}} = {};
  for (const [method, handler] of Object.entries(methodHandlers)) {
    handlers[method] =
      typeof handler === "function"
        ? {handler, noAuth: false}
        : {...handler, noAuth: handler.noAuth ?? false};
  }

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const methodHandler = handlers[req.method!];

    if (!methodHandler) {
      res.status(405).end(`method ${req.method} not allowed`);
      return;
    }

    // Auth can be disabled on a per method basis because some admin api
    // routes can still be public:
    // for example those that return the list of agreements (GET),
    // even though cherry-picking endpoints that require authentication is
    // not the best developer's UX.
    if (!methodHandler.noAuth) {
      /**
       * Requires an authenticated user for an API request. Inspects request
       * headers to look for a valid JWT Bearer token. Stops request handling
       * and returns 401 for unauthorized users.
       */
      try {
        const user = await readJWTBearer(req);
        (req as unknown as AuthContext).user = user;
      } catch (err: any) {
        res.status(401).end(err);
        return;
      }
    }

    await handleExceptions(res, () => methodHandler.handler(req, res));
  };
}
