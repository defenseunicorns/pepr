// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var apiv1_pb = require('./apiv1_pb.js');

function serialize_api_WatchRequest(arg) {
  if (!(arg instanceof apiv1_pb.WatchRequest)) {
    throw new Error('Expected argument of type api.WatchRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_api_WatchRequest(buffer_arg) {
  return apiv1_pb.WatchRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_api_WatchResponse(arg) {
  if (!(arg instanceof apiv1_pb.WatchResponse)) {
    throw new Error('Expected argument of type api.WatchResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_api_WatchResponse(buffer_arg) {
  return apiv1_pb.WatchResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var WatchServiceService = exports.WatchServiceService = {
  watch: {
    path: '/api.WatchService/Watch',
    requestStream: false,
    responseStream: true,
    requestType: apiv1_pb.WatchRequest,
    responseType: apiv1_pb.WatchResponse,
    requestSerialize: serialize_api_WatchRequest,
    requestDeserialize: deserialize_api_WatchRequest,
    responseSerialize: serialize_api_WatchResponse,
    responseDeserialize: deserialize_api_WatchResponse,
  },
};

exports.WatchServiceClient = grpc.makeGenericClientConstructor(WatchServiceService);
