import { WatchServiceClient } from "../generated/apiv1_grpc_pb";
import { WatchRequest } from "../generated/apiv1_pb";
import * as grpc from "@grpc/grpc-js";
import { Binding } from "./types";

export interface StreamClient {
  /*
   * Opens a stream to watch for changes
   */
  watch(): grpc.ClientReadableStream<unknown>;
  /*
   * Configures the stream with the given binding
   */
  configure(binding: Binding): void;
  /*
   * Returns the resource type being watched
   */
  getResource(): string;
  /*
   * Returns the resource version being watched
   */
  getVersion(): string;
  /*
   * Returns the resource group being watched
   */
  getGroup(): string;
  /*
   * Returns the resource namespace being watched
   */
  getNamespace(): string;
}
/**
 * Setups and manages the watch stream for a given binding
 */

export class StreamProcessor implements StreamClient {
  client: WatchServiceClient;
  request: WatchRequest;

  constructor() {
    this.client = new WatchServiceClient("localhost:50051", grpc.credentials.createInsecure());
    this.request = new WatchRequest();
  }
  watch = () => {
    return this.client.watch(this.request);
  };

  configure = (binding: Binding) => {
    this.request.setResource(binding.kind?.kind ? binding.kind.kind : "");
    this.request.setVersion(binding.kind?.version ? binding.kind.version : "v1");
    this.request.setGroup(binding.kind?.group ? binding.kind.group : "");
    this.request.setNamespace(binding.filters.namespaces ? binding.filters.namespaces[0] : "");
  };

  getResource() {
    return this.request.getResource();
  }

  getVersion() {
    return this.request.getVersion();
  }

  getGroup() {
    return this.request.getGroup();
  }

  getNamespace() {
    return this.request.getNamespace();
  }
}
