# Pepr Store

## A Lightweight Key-Value Store for Pepr Modules

The nature of admission controllers and general watch operations (the `Mutate`, `Validate` and `Watch` actions in Pepr) make some types of complex and long-running operations difficult. There are also times when you need to share data between different actions. While you could manually create your own K8s resources and manage their cleanup, this can be very hard to track and keep performant at scale.

The Pepr Store solves this by exposing a simple, [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage)-compatible mechanism for use within capabilities. Additionally, as Pepr runs multiple replicas of the admission controller along with a watch controller, the Pepr Store provides a unique way to share data between these different instances automatically.

Each Pepr Capability has a `Store` instance that can be used to get, set and delete data as well as subscribe to any changes to the Store. Behind the scenes, all capability store instances in a single Pepr Module are stored within a single CRD in the cluster. This CRD is automatically created when the Pepr Module is deployed. Care is taken to make the read and write operations as efficient as possible by using K8s watches, batch processing and patch operations for writes.

## Key Features

- **Asynchronous Key-Value Store**: Provides an asynchronous interface for storing small amounts of data, making it ideal for sharing information between various actions and capabilities.
- **Web Storage API Compatibility**: The store's API is aligned with the standard [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage), simplifying the learning curve.
- **Real-time Updates**: The `.subscribe()` and `onReady()` methods enable real-time updates, allowing you to react to changes in the data store instantaneously.
- **Automatic CRD Management**: Each Pepr Module has its data stored within a single Custom Resource Definition (CRD) that is automatically created upon deployment.
- **Efficient Operations**: Pepr Store uses Kubernetes watches, batch processing, and patch operations to make read and write operations as efficient as possible.

## Quick Start

```typescript
// Example usage for Pepr Store
Store.setItem("example-1", "was-here");
Store.setItem("example-1-data", JSON.stringify(request.Raw.data));
Store.onReady(data => {
  Log.info(data, "Pepr Store Ready");
});
const unsubscribe = Store.subscribe(data => {
  Log.info(data, "Pepr Store Updated");
  unsubscribe();
});
```

## API Reference

### Methods

- `getItem(key: string)`: Retrieves a value by its key. Returns `null` if the key doesn't exist.
- `setItem(key: string, value: string)`: Sets a value for a given key. Creates a new key-value pair if the key doesn't exist.
- `setItemAndWait(key: string, value: string)`: Sets a value for a given key. Creates a new key-value pair if the key doesn't exist. Resolves a promise when the new key and value show up in the store. Note - Async operations in Mutate and Validate are susceptible to [timeouts](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#timeouts).
- `removeItem(key: string)`: Deletes a key-value pair by its key.
- `removeItemAndWait(key: string)`: Deletes a key-value pair by its key and resolves a promise when the key and value do not show up in the store. Note - Async operations in Mutate and Validate are susceptible to [timeouts](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/#timeouts).
- `clear()`: Clears all key-value pairs from the store.
- `subscribe(listener: DataReceiver)`: Subscribes to store updates.
- `onReady(callback: DataReceiver)`: Executes a callback when the store is ready.
