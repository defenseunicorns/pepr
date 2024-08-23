
// GENERATED CODE -- DO NOT EDIT!


/* eslint-disable */

// package: api
// file: apiv1.proto

import * as apiv1_pb from "./apiv1_pb";
import * as grpc from "@grpc/grpc-js";

interface IWatchServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
  watch: grpc.MethodDefinition<apiv1_pb.WatchRequest, apiv1_pb.WatchResponse>;
}

export const WatchServiceService: IWatchServiceService;

export interface IWatchServiceServer extends grpc.UntypedServiceImplementation {
  watch: grpc.handleServerStreamingCall<apiv1_pb.WatchRequest, apiv1_pb.WatchResponse>;
}

export class WatchServiceClient extends grpc.Client {
  constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
  watch(
    argument: apiv1_pb.WatchRequest,
    metadataOrOptions?: grpc.Metadata | grpc.CallOptions | null,
  ): grpc.ClientReadableStream<apiv1_pb.WatchResponse>;
  watch(
    argument: apiv1_pb.WatchRequest,
    metadata?: grpc.Metadata | null,
    options?: grpc.CallOptions | null,
  ): grpc.ClientReadableStream<apiv1_pb.WatchResponse>;
}
