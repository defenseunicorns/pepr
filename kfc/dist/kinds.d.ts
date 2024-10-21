import { GenericClass, GroupVersionKind } from "./types";
/**
 * Converts a model name to a GroupVersionKind
 *
 * @param key The name of the model
 * @returns The GroupVersionKind for the model
 */
export declare function modelToGroupVersionKind(key: string): GroupVersionKind;
/**
 * Registers a new model and GroupVersionKind to be used within the fluent API.
 *
 * @param model Used to match the GroupVersionKind and define the type-data for the request
 * @param groupVersionKind Contains the match parameters to determine the request should be handled
 */
export declare const RegisterKind: (model: GenericClass, groupVersionKind: GroupVersionKind) => void;
//# sourceMappingURL=kinds.d.ts.map