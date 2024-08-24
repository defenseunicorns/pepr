// package: api
// file: apiv1.proto

import * as jspb from "google-protobuf";

export class WatchRequest extends jspb.Message {
  getGroup(): string;
  setGroup(value: string): void;

  getVersion(): string;
  setVersion(value: string): void;

  getResource(): string;
  setResource(value: string): void;

  getNamespace(): string;
  setNamespace(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): WatchRequest.AsObject;
  static toObject(includeInstance: boolean, msg: WatchRequest): WatchRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: WatchRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): WatchRequest;
  static deserializeBinaryFromReader(message: WatchRequest, reader: jspb.BinaryReader): WatchRequest;
}

export namespace WatchRequest {
  export type AsObject = {
    group: string,
    version: string,
    resource: string,
    namespace: string,
  }
}

export class WatchResponse extends jspb.Message {
  getEventtype(): string;
  setEventtype(value: string): void;

  getDetails(): string;
  setDetails(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): WatchResponse.AsObject;
  static toObject(includeInstance: boolean, msg: WatchResponse): WatchResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: WatchResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): WatchResponse;
  static deserializeBinaryFromReader(message: WatchResponse, reader: jspb.BinaryReader): WatchResponse;
}

export namespace WatchResponse {
  export type AsObject = {
    eventtype: string,
    details: string,
  }
}

