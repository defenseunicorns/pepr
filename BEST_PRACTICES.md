# Pepr Best Practices

## TOC

- [Store](#pepr-store)
- [OnSchedule](#onschedule)


## Pepr Store

Store is backed by ETCD in a `PeprStore` resource. Updates occur at 5 second intervals when arrays of patches are sent to the Kubernetes API Server.

- Not designed to be a `transactional` store.


## OnSchedule

`OnSchedule` is backed by a `PeprStore` that is not accessible to the schedule controller. This backs up store data to prevent schedule loss under a pod restart. Due to the store backing, best practices roughly resemble best pratices of the store.

- `UseInterval` should be used at the top-level, not inside a `Validate`, `Mutate`, or `Watch`.
- Due to store backing and avoiding potential patch conflicts, interval are recommended to be 30 seconds or longer.
- Jobs should be idempotent 


- [TOP](#pepr-best-practices)
