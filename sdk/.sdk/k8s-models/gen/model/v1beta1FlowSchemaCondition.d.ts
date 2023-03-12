/**
 * Kubernetes
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: release-1.25
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
/**
* FlowSchemaCondition describes conditions for a FlowSchema.
*/
export declare class V1beta1FlowSchemaCondition {
    /**
    * `lastTransitionTime` is the last time the condition transitioned from one status to another.
    */
    'lastTransitionTime'?: Date;
    /**
    * `message` is a human-readable message indicating details about last transition.
    */
    'message'?: string;
    /**
    * `reason` is a unique, one-word, CamelCase reason for the condition\'s last transition.
    */
    'reason'?: string;
    /**
    * `status` is the status of the condition. Can be True, False, Unknown. Required.
    */
    'status'?: string;
    /**
    * `type` is the type of the condition. Required.
    */
    'type'?: string;
    static discriminator: string | undefined;
    static attributeTypeMap: Array<{
        name: string;
        baseName: string;
        type: string;
    }>;
    static getAttributeTypeMap(): {
        name: string;
        baseName: string;
        type: string;
    }[];
}
