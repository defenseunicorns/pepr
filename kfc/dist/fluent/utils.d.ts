import { URL } from "url";
import { GenericClass } from "../types";
import { ApplyCfg, FetchMethods, Filters } from "./types";
/**
 * Generate a path to a Kubernetes resource
 *
 * @param serverUrl - the URL of the Kubernetes API server
 * @param model - the model to use for the API
 * @param filters - (optional) filter overrides, can also be chained
 * @param excludeName - (optional) exclude the name from the path
 * @returns the path to the resource
 */
export declare function pathBuilder<T extends GenericClass>(serverUrl: string, model: T, filters: Filters, excludeName?: boolean): URL;
/**
 * Sets up the kubeconfig and https agent for a request
 *
 * A few notes:
 * - The kubeconfig is loaded from the default location, and can check for in-cluster config
 * - We have to create an agent to handle the TLS connection (for the custom CA + mTLS in some cases)
 * - The K8s lib uses request instead of node-fetch today so the object is slightly different
 *
 * @param method - the HTTP method to use
 * @returns the fetch options and server URL
 */
export declare function k8sCfg(method: FetchMethods): Promise<{
    opts: import("node-fetch").RequestInit;
    serverUrl: string;
}>;
/**
 * Execute a request against the Kubernetes API server.
 *
 * @param model - the model to use for the API
 * @param filters - (optional) filter overrides, can also be chained
 * @param method - the HTTP method to use
 * @param payload - (optional) the payload to send
 * @param applyCfg - (optional) configuration for the apply method
 *
 * @returns the parsed JSON response
 */
export declare function k8sExec<T extends GenericClass, K>(model: T, filters: Filters, method: FetchMethods, payload?: K | unknown, applyCfg?: ApplyCfg): Promise<K>;
//# sourceMappingURL=utils.d.ts.map